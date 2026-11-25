<?php

namespace App\Services;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use App\Models\RainfallRecord;
use Illuminate\Support\Collection;

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
        $start = (int) str_replace('-', '', config('raincheck.comparison_start'));
        $end = (int) str_replace('-', '', config('raincheck.comparison_end'));
        $records = RainfallRecord::whereRaw('(year * 100 + month) between ? and ?', [$start, $end])->count();

        return "Data in the database:\n"
            .'- '.$districts->count().' districts in '.$districts->pluck('province')->unique()->count().' provinces ('
            .$districts->pluck('province')->unique()->implode(', ').").\n"
            ."- {$records} monthly satellite rainfall records for ".$this->comparisonPeriodLabel().". Historical records are retained only to calculate normal rainfall.\n"
            .'- One household drought percentage per district (CFSVA 2024), plus any extra surveys saved by an admin (listed at the end).'."\n"
            .'- A poverty rate per district (EICV7 2024). It is stored, but it is not part of the mismatch score.';
    }

    private function nationalSummary(Collection $districts): string
    {
        $compared = $districts->filter(fn (array $d) => $d['household_drought_pct'] !== null);
        $levels = $compared->countBy(fn (array $d) => $d['summary']['risk_level']);
        $directions = $compared->countBy(fn (array $d) => $d['summary']['direction']);

        $poverty = $this->poverty;

        return "Country summary:\n"
            .'- Rank correlation between satellite and household scores: '.($this->analysis->rankCorrelation($districts) ?? 'n/a')."\n"
            .'- Average share of households reporting drought across districts: '
            .($compared->count() ? round($compared->avg('household_drought_pct'), 1).'%' : 'n/a')."\n"
            .'- Mismatch risk: '.($levels['high'] ?? 0).' districts high, '.($levels['medium'] ?? 0).' medium, '.($levels['low'] ?? 0).' low.'."\n"
            .'- Satellite understates drought (households worse than satellite) in '.($directions['satellite_understates'] ?? 0)
            .' districts; satellite overstates in '.($directions['satellite_overstates'] ?? 0).'; they agree in '.($directions['agrees'] ?? 0).".\n"
            .($poverty->isNotEmpty() ? '- Average poverty rate across districts: '.round($poverty->avg(), 1)."%.\n" : '');
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

        $names = $districts->pluck('name', 'id');
        $mm = fn (float $value) => round($value, 1).' mm';

        // Rainfall across all districts: the average of the district values for each month in the comparison window.
        $byCalendarMonth = $records->groupBy('month')->map(fn (Collection $rows) => (float) $rows->avg('rainfall_mm'))->sortKeys();
        $wettest = $byCalendarMonth->sortDesc();
        $driest = $byCalendarMonth->sort();

        $districtRain = $records->groupBy('district_id')->map(function (Collection $rows, $id) use ($names) {
            $months = $rows->groupBy('month')->map(fn (Collection $m) => (float) $m->avg('rainfall_mm'))->sortKeys();
            $wet = $months->sortDesc()->keys()->first();
            $dry = $months->sort()->keys()->first();

            return [
                'name' => $names[$id] ?? 'District '.$id,
                'wettest_month' => $wet,
                'wettest_rainfall' => $months[$wet],
                'driest_month' => $dry,
                'driest_rainfall' => $months[$dry],
                'total' => (float) $rows->sum('rainfall_mm'),
            ];
        })->sortBy('name')->values();

        $rank = fn (string $key, bool $desc) => $districtRain->whereNotNull($key)
            ->sortBy($key, SORT_REGULAR, $desc)->take(5)
            ->map(fn (array $d) => $d['name'].' ('.$mm($d[$key]).')')->implode(', ');
        $provinceOf = $districts->pluck('province', 'name');
        $provinceRain = $districtRain->groupBy(fn (array $d) => $provinceOf[$d['name']] ?? 'Unknown')
            ->map(fn (Collection $rows) => (float) $rows->avg('total'))->sortDesc()
            ->map(fn (float $v, string $province) => $province.' ('.$mm($v).')')->implode(', ');
        $districtLines = $districtRain->map(fn (array $d) => '- '.$d['name'].': '.$mm($d['total']).' total; wettest '
            .$this->monthName((int) $d['wettest_month']).' '.$mm($d['wettest_rainfall']).'; driest '
            .$this->monthName((int) $d['driest_month']).' '.$mm($d['driest_rainfall']))->implode("\n");

        return 'Amount of rain during '.$this->comparisonPeriodLabel()." (satellite estimate, millimetres):\n"
            .'- Average rain by month across districts: '.$byCalendarMonth->map(fn (float $v, $m) => $this->monthName((int) $m).' '.$mm($v))->implode(', ').".\n"
            .'- Wettest month across districts: '.$this->monthName((int) $wettest->keys()->first()).' ('.$mm($wettest->first()).'). '
            .'Driest: '.$this->monthName((int) $driest->keys()->first()).' ('.$mm($driest->first()).").\n"
            .'- Districts ranked by total rainfall in the comparison period: '.$rank('total', true).".\n"
            ."- Provinces ranked by average district rainfall in the comparison period: {$provinceRain}.\n"
            ."Rain for each district in the comparison period:\n{$districtLines}";
    }

    private function provinceSummary(Collection $districts): string
    {
        $lines = $districts->groupBy('province')->map(function (Collection $rows, string $province) {
            $household = $rows->pluck('household_drought_pct')->filter(fn ($v) => $v !== null);
            $high = $rows->where('summary.risk_level', 'high')->pluck('name')->implode(', ');

            return "- {$province} ({$rows->count()} districts): average households reporting drought "
                .($household->count() ? round($household->avg(), 1).'%' : 'n/a')
                .', average satellite dry months in the comparison year '
                .round($rows->avg('summary.satellite_drought_months'), 1)
                .', districts with high mismatch: '.($high ?: 'none');
        });

        return "By province:\n".$lines->implode("\n");
    }

    private function rankings(Collection $districts): string
    {
        $compared = $districts->filter(fn (array $d) => $d['household_drought_pct'] !== null);

        $top = fn (string $label, Collection $sorted, callable $value) => "- {$label}: "
            .$sorted->take(5)->map(fn (array $d) => $d['name'].' ('.$value($d).')')->implode(', ');

        return "Rankings (top 5):\n"
            .$top('Most households reporting drought', $compared->sortByDesc('household_drought_pct'), fn ($d) => $d['household_drought_pct'].'%')."\n"
            .$top('Fewest households reporting drought', $compared->sortBy('household_drought_pct'), fn ($d) => $d['household_drought_pct'].'%')."\n"
            .$top('Most satellite dry months in the comparison year', $districts->sortByDesc('summary.satellite_drought_months'), fn ($d) => $d['summary']['satellite_drought_months'].' months')."\n"
            .$top('Fewest satellite dry months in the comparison year', $districts->sortBy('summary.satellite_drought_months'), fn ($d) => $d['summary']['satellite_drought_months'].' months')."\n"
            .$top('Biggest mismatch', $compared->sortByDesc('summary.basis_risk_pct'), fn ($d) => $d['summary']['basis_risk_pct'].' points, '.$this->directionText($d['summary']['direction']))."\n"
            .$top('Smallest mismatch', $compared->sortBy('summary.basis_risk_pct'), fn ($d) => $d['summary']['basis_risk_pct'].' points');
    }

    private function districtTable(Collection $districts): string
    {
        $rows = $districts->map(function (array $d) {
            $s = $d['summary'];
            $poverty = $this->poverty->has($d['id']) ? round((float) $this->poverty[$d['id']], 1) : null;

            return implode(' | ', array_filter([
                $d['name'],
                $d['province'],
                'households reporting drought: '.($d['household_drought_pct'] ?? 'n/a').'%',
                'satellite dry months ('.$this->comparisonPeriodLabel().'): '.$s['satellite_drought_months'],
                'satellite score: '.($s['satellite_rank_pct'] ?? 'n/a'),
                'household score: '.($s['household_rank_pct'] ?? 'n/a'),
                'gap: '.($s['basis_risk_pct'] ?? 'n/a').' points',
                'mismatch risk: '.$s['risk_level'],
                'direction: '.$this->directionText($s['direction'] ?? null),
                $poverty !== null ? "poverty rate: {$poverty}%" : null,
            ]));
        })->implode("\n");

        return "District data (one line per district):\n{$rows}";
    }

    /**
     * Month by month rainfall for the comparison period and districts the user is asking about.
     */
    private function mentionedDistrictDetail(Collection $districts, array $messages): ?string
    {
        $recent = collect($messages)->where('role', 'user')->pluck('content')->take(-3)->implode(' ');
        $recent = mb_strtolower($recent);

        $mentioned = $districts
            ->filter(fn (array $d) => str_contains($recent, mb_strtolower($d['name'])))
            ->take(self::MAX_DETAILED_DISTRICTS);

        if ($mentioned->isEmpty()) {
            return null;
        }

        $blocks = $mentioned->map(function (array $d) {
            $matchedMonths = collect($d['rainfall'])->filter(fn (array $m) => $this->isInComparisonWindow($m['year'], $m['month']));
            $months = $matchedMonths->map(function (array $m) {
                $flag = ! $m['judged'] ? 'not judged' : ($m['satellite_drought'] ? 'DRY' : 'ok');

                return sprintf('%04d-%02d %smm (normal %smm, %s%s%%) %s', $m['year'], $m['month'], $m['rainfall_mm'], $m['normal_mm'],
                    $m['rainfall_deficit_pct'] > 0 ? 'deficit ' : 'surplus ', abs($m['rainfall_deficit_pct']), $flag);
            })->implode("\n");

            $dryMonths = $matchedMonths->where('satellite_drought', true)
                ->map(fn (array $m) => sprintf('%04d-%02d', $m['year'], $m['month']))->implode(', ');

            return "{$d['name']} district, every month (rainfall, normal for that month, difference, verdict):\n{$months}\n"
                ."{$d['name']} dry months: ".($dryMonths ?: 'none');
        });

        return "Detailed monthly rainfall for the districts in this chat:\n".$blocks->implode("\n\n");
    }

    private function savedSurveys(): ?string
    {
        $imports = HouseholdSurveyImport::with('observations.district:id,name')
            ->orderByDesc('survey_year')->orderByDesc('id')->limit(5)->get();

        if ($imports->isEmpty()) {
            return null;
        }

        $blocks = $imports->map(function (HouseholdSurveyImport $import) {
            $values = $import->observations
                ->sortBy(fn ($o) => $o->district->name)
                ->map(fn ($o) => $o->district->name.' '.$o->household_drought_pct.'%')
                ->implode(', ');

            return "- {$import->source_name}, survey year {$import->survey_year}, {$import->observations->count()} districts: {$values}";
        });

        return "Extra household surveys saved by an admin (households reporting drought, % by district):\n".$blocks->implode("\n");
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
