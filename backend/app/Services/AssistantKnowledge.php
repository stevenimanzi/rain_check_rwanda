<?php

namespace App\Services;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use App\Models\RainfallRecord;
use Illuminate\Support\Collection;

/** Builds the data summary that is sent with each assistant request. */
class AssistantKnowledge
{
    /** How many districts mentioned in the chat get their full month-by-month rainfall. */
    private const MAX_DETAILED_DISTRICTS = 3;

    /** Poverty rate by district id, loaded on each build. */
    private Collection $poverty;

    public function __construct(private DistrictAnalysis $analysis)
    {
        $this->poverty = collect();
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages  the conversation so far
     */
    public function build(array $messages): string
    {
        $districts = $this->analysis->all();
        $this->poverty = District::pluck('poverty_rate', 'id')->filter(fn ($rate) => $rate !== null);

        return implode("\n\n", array_filter([
            $this->datasetFacts($districts),
            $this->nationalSummary($districts),
            $this->rainfallAmounts($districts),
            $this->provinceSummary($districts),
            $this->rankings($districts),
            $this->districtTable($districts),
            $this->mentionedDistrictDetail($districts, $messages),
            $this->savedSurveys(),
        ]));
    }

    private function datasetFacts(Collection $districts): string
    {
        $startMonth = (int) str_replace('-', '', config('raincheck.comparison_start'));
        $endMonth = (int) str_replace('-', '', config('raincheck.comparison_end'));
        $rainfallRecordCount = RainfallRecord::whereRaw(
            '(year * 100 + month) between ? and ?',
            [$startMonth, $endMonth],
        )->count();
        $provinces = $districts->pluck('province')->unique();

        return "Data in the database:\n"
            .'- '.$districts->count().' districts in '.$provinces->count().' provinces ('
            .$provinces->implode(', ').").\n"
            ."- {$rainfallRecordCount} monthly satellite rainfall records for ".$this->comparisonPeriodLabel()
            .". Historical records are retained only to calculate normal rainfall.\n"
            .'- One household drought percentage per district (CFSVA 2024), plus any extra surveys saved by an admin (listed at the end).'."\n"
            .'- A poverty rate per district (EICV7 2024). It is stored, but it is not part of the mismatch score.';
    }

    private function nationalSummary(Collection $districts): string
    {
        $comparedDistricts = $districts->filter(
            fn (array $district) => $district['household_drought_pct'] !== null,
        );
        $riskLevelCounts = $comparedDistricts->countBy(
            fn (array $district) => $district['summary']['risk_level'],
        );
        $directionCounts = $comparedDistricts->countBy(
            fn (array $district) => $district['summary']['direction'],
        );

        return "Country summary:\n"
            .'- Rank correlation between satellite and household scores: '.($this->analysis->rankCorrelation($districts) ?? 'n/a')."\n"
            .'- Average share of households reporting drought across districts: '
            .($comparedDistricts->isNotEmpty()
                ? round($comparedDistricts->avg('household_drought_pct'), 1).'%'
                : 'n/a')."\n"
            .'- Mismatch risk: '.($riskLevelCounts['high'] ?? 0).' districts high, '
            .($riskLevelCounts['medium'] ?? 0).' medium, '.($riskLevelCounts['low'] ?? 0).' low.'."\n"
            .'- Satellite understates drought (households worse than satellite) in '
            .($directionCounts['satellite_understates'] ?? 0)
            .' districts; satellite overstates in '.($directionCounts['satellite_overstates'] ?? 0)
            .'; they agree in '.($directionCounts['agrees'] ?? 0).".\n"
            .($this->poverty->isNotEmpty()
                ? '- Average poverty rate across districts: '.round($this->poverty->avg(), 1)."%.\n"
                : '');
    }

    /**
     * Rainfall amounts for the same 12 months as the household survey.
     */
    private function rainfallAmounts(Collection $districts): ?string
    {
        $records = RainfallRecord::get(['district_id', 'year', 'month', 'rainfall_mm'])
            ->filter(fn (RainfallRecord $record) => $this->isInComparisonWindow($record->year, $record->month))
            ->values();

        if ($records->isEmpty()) {
            return null;
        }

        $districtNames = $districts->pluck('name', 'id');
        // Group by month to calculate the country-wide average rainfall for each month.
        $averageRainfallByMonth = $records
            ->groupBy('month')
            ->map(fn (Collection $monthRecords) => (float) $monthRecords->avg('rainfall_mm'))
            ->sortKeys();
        $wettestMonth = $averageRainfallByMonth->sortDesc();
        $driestMonth = $averageRainfallByMonth->sort();

        $districtRainfall = $records->groupBy('district_id')->map(function (Collection $districtRecords, $districtId) use ($districtNames) {
            $monthlyRainfall = $districtRecords
                ->groupBy('month')
                ->map(fn (Collection $monthRecords) => (float) $monthRecords->avg('rainfall_mm'))
                ->sortKeys();
            $wettestDistrictMonth = $monthlyRainfall->sortDesc()->keys()->first();
            $driestDistrictMonth = $monthlyRainfall->sort()->keys()->first();

            return [
                'name' => $districtNames[$districtId] ?? 'District '.$districtId,
                'wettest_month' => $wettestDistrictMonth,
                'wettest_rainfall' => $monthlyRainfall[$wettestDistrictMonth],
                'driest_month' => $driestDistrictMonth,
                'driest_rainfall' => $monthlyRainfall[$driestDistrictMonth],
                'total' => (float) $districtRecords->sum('rainfall_mm'),
            ];
        })->sortBy('name')->values();

        $formatMillimeters = fn (float $value) => round($value, 1).' mm';
        $formatDistrictRanking = fn (string $key, bool $descending) => $districtRainfall
            ->sortBy($key, SORT_REGULAR, $descending)
            ->take(5)
            ->map(fn (array $district) => $district['name'].' ('.$formatMillimeters($district[$key]).')')
            ->implode(', ');
        $provinceByDistrict = $districts->pluck('province', 'name');
        $averageRainfallByProvince = $districtRainfall
            ->groupBy(fn (array $district) => $provinceByDistrict[$district['name']] ?? 'Unknown')
            ->map(fn (Collection $provinceDistricts) => (float) $provinceDistricts->avg('total'))
            ->sortDesc();
        $provinceRainfall = $averageRainfallByProvince
            ->map(fn (float $rainfall, string $province) => $province.' ('.$formatMillimeters($rainfall).')')
            ->implode(', ');
        $districtRainfallLines = $districtRainfall->map(fn (array $district) => '- '.$district['name'].': '.$formatMillimeters($district['total']).' total; wettest '
            .$this->monthName((int) $district['wettest_month']).' '.$formatMillimeters($district['wettest_rainfall'])
            .'; driest '.$this->monthName((int) $district['driest_month']).' '.$formatMillimeters($district['driest_rainfall'])
        )->implode("\n");

        return 'Amount of rain during '.$this->comparisonPeriodLabel()." (satellite estimate, millimetres):\n"
            .'- Average rain by month across districts: '.$averageRainfallByMonth
                ->map(fn (float $rainfall, int $month) => $this->monthName($month).' '.$formatMillimeters($rainfall))
                ->implode(', ').".\n"
            .'- Wettest month across districts: '.$this->monthName((int) $wettestMonth->keys()->first())
            .' ('.$formatMillimeters($wettestMonth->first()).'). '
            .'Driest: '.$this->monthName((int) $driestMonth->keys()->first())
            .' ('.$formatMillimeters($driestMonth->first()).").\n"
            .'- Districts ranked by total rainfall in the comparison period: '.$formatDistrictRanking('total', true).".\n"
            ."- Provinces ranked by average district rainfall in the comparison period: {$provinceRainfall}.\n"
            ."Rain for each district in the comparison period:\n{$districtRainfallLines}";
    }

    private function provinceSummary(Collection $districts): string
    {
        $districtsByProvince = $districts->groupBy('province');
        $provinceLines = $districtsByProvince->map(function (Collection $provinceDistricts, string $province) {
            $householdDroughtValues = $provinceDistricts
                ->pluck('household_drought_pct')
                ->filter(fn ($value) => $value !== null);
            $highMismatchDistricts = $provinceDistricts
                ->where('summary.risk_level', 'high')
                ->pluck('name')
                ->implode(', ');
            $averageHouseholdDrought = $householdDroughtValues->isNotEmpty()
                ? round($householdDroughtValues->avg(), 1).'%'
                : 'n/a';
            $averageSatelliteDryMonths = round(
                $provinceDistricts->avg('summary.satellite_drought_months'),
                1,
            );

            return "- {$province} ({$provinceDistricts->count()} districts): average households reporting drought "
                .$averageHouseholdDrought
                .', average satellite dry months in the comparison year '.$averageSatelliteDryMonths
                .', districts with high mismatch: '.($highMismatchDistricts ?: 'none');
        });

        return "By province:\n".$provinceLines->implode("\n");
    }

    private function rankings(Collection $districts): string
    {
        $districtsWithHouseholdData = $districts->filter(
            fn (array $district) => $district['household_drought_pct'] !== null,
        );
        $formatRanking = fn (string $label, Collection $rankedDistricts, callable $formatValue) => '- '.$label.': '
            .$rankedDistricts->take(5)
                ->map(fn (array $district) => $district['name'].' ('.$formatValue($district).')')
                ->implode(', ');

        return "Rankings (top 5):\n"
            .$formatRanking(
                'Most households reporting drought',
                $districtsWithHouseholdData->sortByDesc('household_drought_pct'),
                fn (array $district) => $district['household_drought_pct'].'%',
            )."\n"
            .$formatRanking(
                'Fewest households reporting drought',
                $districtsWithHouseholdData->sortBy('household_drought_pct'),
                fn (array $district) => $district['household_drought_pct'].'%',
            )."\n"
            .$formatRanking(
                'Most satellite dry months in the comparison year',
                $districts->sortByDesc('summary.satellite_drought_months'),
                fn (array $district) => $district['summary']['satellite_drought_months'].' months',
            )."\n"
            .$formatRanking(
                'Fewest satellite dry months in the comparison year',
                $districts->sortBy('summary.satellite_drought_months'),
                fn (array $district) => $district['summary']['satellite_drought_months'].' months',
            )."\n"
            .$formatRanking(
                'Biggest mismatch',
                $districtsWithHouseholdData->sortByDesc('summary.basis_risk_pct'),
                fn (array $district) => $district['summary']['basis_risk_pct'].' points, '
                    .$this->directionText($district['summary']['direction']),
            )."\n"
            .$formatRanking(
                'Smallest mismatch',
                $districtsWithHouseholdData->sortBy('summary.basis_risk_pct'),
                fn (array $district) => $district['summary']['basis_risk_pct'].' points',
            );
    }

    private function districtTable(Collection $districts): string
    {
        $districtLines = $districts->map(function (array $district) {
            $summary = $district['summary'];
            $povertyRate = $this->poverty->has($district['id'])
                ? round((float) $this->poverty[$district['id']], 1)
                : null;

            $details = [
                $district['name'],
                $district['province'],
                'households reporting drought: '.($district['household_drought_pct'] ?? 'n/a').'%',
                'satellite dry months ('.$this->comparisonPeriodLabel().'): '.$summary['satellite_drought_months'],
                'satellite score: '.($summary['satellite_rank_pct'] ?? 'n/a'),
                'household score: '.($summary['household_rank_pct'] ?? 'n/a'),
                'gap: '.($summary['basis_risk_pct'] ?? 'n/a').' points',
                'mismatch risk: '.$summary['risk_level'],
                'direction: '.$this->directionText($summary['direction'] ?? null),
            ];

            if ($povertyRate !== null) {
                $details[] = "poverty rate: {$povertyRate}%";
            }

            return implode(' | ', $details);
        })->implode("\n");

        return "District data (one line per district):\n{$districtLines}";
    }

    /**
     * Month by month rainfall for the comparison period and districts the user is asking about.
     */
    private function mentionedDistrictDetail(Collection $districts, array $messages): ?string
    {
        $recentUserMessages = collect($messages)
            ->where('role', 'user')
            ->pluck('content')
            ->take(-3)
            ->implode(' ');
        $recentUserMessages = mb_strtolower($recentUserMessages);

        $mentionedDistricts = $districts
            ->filter(fn (array $district) => str_contains(
                $recentUserMessages,
                mb_strtolower($district['name']),
            ))
            ->take(self::MAX_DETAILED_DISTRICTS);

        if ($mentionedDistricts->isEmpty()) {
            return null;
        }

        $districtBlocks = $mentionedDistricts->map(function (array $district) {
            $comparisonMonths = collect($district['rainfall'])
                ->filter(fn (array $month) => $this->isInComparisonWindow($month['year'], $month['month']));
            $monthlyRainfallLines = $comparisonMonths->map(function (array $month) {
                $status = ! $month['judged']
                    ? 'not judged'
                    : ($month['satellite_drought'] ? 'DRY' : 'ok');
                $differenceLabel = $month['rainfall_deficit_pct'] > 0 ? 'deficit ' : 'surplus ';

                return sprintf(
                    '%04d-%02d %smm (normal %smm, %s%s%%) %s',
                    $month['year'],
                    $month['month'],
                    $month['rainfall_mm'],
                    $month['normal_mm'],
                    $differenceLabel,
                    abs($month['rainfall_deficit_pct']),
                    $status,
                );
            })->implode("\n");

            $dryMonths = $comparisonMonths
                ->where('satellite_drought', true)
                ->map(fn (array $month) => sprintf('%04d-%02d', $month['year'], $month['month']))
                ->implode(', ');
            $dryMonthList = $dryMonths ?: 'none';
            $districtName = $district['name'];

            return "{$districtName} district, every month (rainfall, normal for that month, difference, verdict):\n"
                ."{$monthlyRainfallLines}\n"
                ."{$districtName} dry months: {$dryMonthList}";
        });

        return "Detailed monthly rainfall for the districts in this chat:\n".$districtBlocks->implode("\n\n");
    }

    private function savedSurveys(): ?string
    {
        $imports = HouseholdSurveyImport::with('observations.district:id,name')
            ->orderByDesc('survey_year')->orderByDesc('id')->limit(5)->get();

        if ($imports->isEmpty()) {
            return null;
        }

        $surveyLines = $imports->map(function (HouseholdSurveyImport $import) {
            $districtValues = $import->observations
                ->sortBy(fn ($observation) => $observation->district->name)
                ->map(fn ($observation) => $observation->district->name.' '.$observation->household_drought_pct.'%')
                ->implode(', ');

            return "- {$import->source_name}, survey year {$import->survey_year}, "
                ."{$import->observations->count()} districts: {$districtValues}";
        });

        return "Extra household surveys saved by an admin (households reporting drought, % by district):\n"
            .$surveyLines->implode("\n");
    }

    private function directionText(?string $direction): string
    {
        return match ($direction) {
            'satellite_understates' => 'satellite shows less drought than households reported',
            'satellite_overstates' => 'satellite shows more drought than households reported',
            'agrees' => 'satellite and households agree',
            default => 'n/a',
        };
    }

    private function monthName(int $month): string
    {
        return date('F', mktime(0, 0, 0, $month, 1));
    }

    private function comparisonPeriodLabel(): string
    {
        [$startYear, $startMonth] = array_map('intval', explode('-', config('raincheck.comparison_start')));
        [$endYear, $endMonth] = array_map('intval', explode('-', config('raincheck.comparison_end')));

        return $this->monthName($startMonth).' '.$startYear.' to '.$this->monthName($endMonth).' '.$endYear;
    }

    private function isInComparisonWindow(int $year, int $month): bool
    {
        $key = sprintf('%04d-%02d', $year, $month);

        return $key >= config('raincheck.comparison_start')
            && $key <= config('raincheck.comparison_end');
    }
}
