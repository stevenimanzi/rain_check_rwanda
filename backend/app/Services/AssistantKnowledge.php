<?php

namespace App\Services;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use App\Models\RainfallRecord;
use Illuminate\Support\Collection;

/**
 * Turns the database into the text the AI assistant answers from.
 * It is rebuilt on every request, so the assistant always matches the dashboard and any saved survey.
 */
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
        $records = RainfallRecord::count();
        $firstYear = RainfallRecord::min('year');
        $lastYear = RainfallRecord::max('year');

        return "Data in the database:\n"
            .'- '.$districts->count().' districts in '.$districts->pluck('province')->unique()->count().' provinces ('
            .$districts->pluck('province')->unique()->implode(', ').").\n"
            ."- {$records} monthly satellite rainfall records, {$firstYear} to {$lastYear}.\n"
            .'- One household drought percentage per district (CFSVA 2024), plus any extra surveys saved by an admin (listed at the end).'."\n"
            .'- A poverty rate per district (EICV7 2024). It is stored, but it is not part of the mismatch score.';
    }

    private function nationalSummary(Collection $districts): string
    {
        $compared = $districts->filter(fn (array $d) => $d['household_drought_pct'] !== null);
        $levels = $compared->countBy(fn (array $d) => $d['summary']['risk_level']);
        $directions = $compared->countBy(fn (array $d) => $d['summary']['direction']);

        $byYear = $districts->pluck('history.by_year')->flatten(1)->groupBy('year')
            ->map(fn (Collection $rows, $year) => $year.': '.round($rows->avg('dry_months'), 1))
            ->sortKeys()->implode(', ');

        $byMonth = $districts->pluck('history.by_calendar_month')->flatten(1)->groupBy('month')
            ->map(function (Collection $rows, $month) {
                $values = $rows->whereNotNull('dry_pct');

                return $this->monthName((int) $month).': '.($values->count() ? round($values->avg('dry_pct'), 1).'%' : 'not judged');
            })->implode(', ');

        $poverty = $this->poverty;

        return "Country summary:\n"
            .'- Rank correlation between satellite and household scores: '.($this->analysis->rankCorrelation($districts) ?? 'n/a')."\n"
            .'- Average share of households reporting drought across districts: '
            .($compared->count() ? round($compared->avg('household_drought_pct'), 1).'%' : 'n/a')."\n"
            .'- Mismatch risk: '.($levels['high'] ?? 0).' districts high, '.($levels['medium'] ?? 0).' medium, '.($levels['low'] ?? 0).' low.'."\n"
            .'- Satellite understates drought (households worse than satellite) in '.($directions['satellite_understates'] ?? 0)
            .' districts; satellite overstates in '.($directions['satellite_overstates'] ?? 0).'; they agree in '.($directions['agrees'] ?? 0).".\n"
            ."- Average dry months per district in each year: {$byYear}.\n"
            ."- Share of years a district is dry, by calendar month (average of districts): {$byMonth}.\n"
            .($poverty->isNotEmpty() ? '- Average poverty rate across districts: '.round($poverty->avg(), 1)."%.\n" : '');
    }

    /**
     * How much rain falls, in millimetres: wettest and driest months, by calendar month, by year, and for each district.
     * Without this the assistant can only talk about dry months, not about amounts of rain.
     */
    private function rainfallAmounts(Collection $districts): ?string
    {
        $records = RainfallRecord::get(['district_id', 'year', 'month', 'rainfall_mm']);

        if ($records->isEmpty()) {
            return null;
        }

        $names = $districts->pluck('name', 'id');
        $mm = fn (float $value) => round($value, 1).' mm';

        // Rainfall across all districts: the average of the district values for each calendar month.
        $byCalendarMonth = $records->groupBy('month')->map(fn (Collection $rows) => (float) $rows->avg('rainfall_mm'))->sortKeys();
        $wettest = $byCalendarMonth->sortDesc();
        $driest = $byCalendarMonth->sort();

        $byYearMonth = $records->groupBy(fn ($r) => $r->year.'-'.$r->month)->map(fn (Collection $rows) => (float) $rows->avg('rainfall_mm'));
        $wettestOnRecord = $byYearMonth->sortDesc()->take(3)->map(function (float $value, string $key) use ($mm) {
            [$year, $month] = explode('-', $key);

            return $this->monthName((int) $month).' '.$year.' ('.$mm($value).')';
        })->implode(', ');

        $yearTotals = $records->groupBy('year')->map(fn (Collection $rows) => (float) $rows->groupBy('month')->map(fn ($m) => $m->avg('rainfall_mm'))->sum())->sortKeys();
        $totals = $yearTotals->map(fn (float $value, $year) => $year.': '.$mm($value))->implode(', ');

        $perDistrict = $records->groupBy('district_id')->map(function (Collection $rows, $id) use ($names, $mm) {
            $months = $rows->groupBy('month')->map(fn (Collection $m) => (float) $m->avg('rainfall_mm'));
            $wet = $months->sortDesc()->keys()->first();
            $dry = $months->sort()->keys()->first();

            return '- '.($names[$id] ?? 'District '.$id).': wettest month '.$this->monthName((int) $wet).' ('.$mm($months[$wet])
                .'), driest month '.$this->monthName((int) $dry).' ('.$mm($months[$dry]).')';
        })->sortKeys()->implode("
");

        return "Amount of rain (satellite estimate, millimetres per month, average of all districts and years):
"
            .'- Average rain by calendar month: '.$byCalendarMonth->map(fn (float $v, $m) => $this->monthName((int) $m).' '.$mm($v))->implode(', ').".
"
            .'- Wettest calendar month on average: '.$this->monthName((int) $wettest->keys()->first()).' ('.$mm($wettest->first()).'). '
            .'Driest: '.$this->monthName((int) $driest->keys()->first()).' ('.$mm($driest->first()).").
"
            ."- Three wettest single months on record (average of all districts): {$wettestOnRecord}.
"
            ."- Total rain in each year, average of districts: {$totals}.
"
            ."Wettest and driest calendar month for each district (average over the years):
{$perDistrict}";
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
            $dryByYear = collect($d['history']['by_year'])->map(fn ($y) => $y['year'].':'.$y['dry_months'])->implode(' ');

            return implode(' | ', array_filter([
                $d['name'],
                $d['province'],
                'households reporting drought: '.($d['household_drought_pct'] ?? 'n/a').'%',
                'satellite dry months (Apr 2023-Mar 2024): '.$s['satellite_drought_months'],
                'average dry months a year: '.($s['avg_dry_months_per_year'] ?? 'n/a'),
                'dry months by year ['.$dryByYear.']',
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
     * Month by month rainfall for districts the user is asking about, so questions like
     * "was April 2022 dry in Huye?" can be answered from real rows.
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
            $months = collect($d['rainfall'])->map(function (array $m) {
                $flag = ! $m['judged'] ? 'not judged' : ($m['satellite_drought'] ? 'DRY' : 'ok');

                return sprintf('%04d-%02d %smm (normal %smm, %s%s%%) %s', $m['year'], $m['month'], $m['rainfall_mm'], $m['normal_mm'],
                    $m['rainfall_deficit_pct'] > 0 ? 'deficit ' : 'surplus ', abs($m['rainfall_deficit_pct']), $flag);
            })->implode("\n");

            $dryMonths = collect($d['rainfall'])->where('satellite_drought', true)
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
}
