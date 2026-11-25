<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * "How often did the rain suit this crop?" for every district and every planting month.
 *
 * It replays the satellite rainfall of 2014 to 2024: for each year it asks whether a crop planted in a given month
 * would have had the rain it needs (see config/crops.php). The share of years that did is the chance shown to
 * the user. It is a record of what happened, not a weather forecast, so it is always shown with the number of
 * years behind it and an uncertainty range.
 *
 * A district is only used when its satellite rainfall can be trusted: households and satellite must not disagree
 * strongly there. Districts with high mismatch risk are left out; medium and low are kept.
 */
class CropSuitability
{
    private const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    public function __construct(private DistrictAnalysis $analysis)
    {
    }

    /** @return array<string, array<string, mixed>> crop id => profile (with the id added) */
    public function crops(): array
    {
        return collect(Arr::except(config('crops'), 'aliases'))
            ->map(fn (array $profile, string $id) => ['id' => $id] + $profile)
            ->all();
    }

    public function profile(string $cropId): ?array
    {
        return $this->crops()[$cropId] ?? null;
    }

    /**
     * Crops named in a piece of text, in English, French or Kinyarwanda.
     *
     * @return array<int, string>
     */
    public function cropIdsIn(string $text): array
    {
        $text = mb_strtolower($text);

        return collect(config('crops.aliases'))
            ->filter(fn (array $words) => collect($words)->contains(fn (string $word) => preg_match('/(?<![\p{L}])'.preg_quote($word, '/').'(?![\p{L}])/u', $text) === 1))
            ->keys()
            ->values()
            ->all();
    }

    public static function monthName(int $month): string
    {
        return self::MONTHS[$month] ?? '';
    }

    /**
     * Every usable district ranked for one crop, and the districts that were left out with the reason.
     *
     * @param  Collection|null  $districts  the output of DistrictAnalysis::all(), when the caller already has it
     */
    public function forCrop(string $cropId, ?Collection $districts = null): ?array
    {
        $profile = $this->profile($cropId);

        if ($profile === null) {
            return null;
        }

        $districts ??= $this->analysis->all();
        $ranking = collect();
        $excluded = collect();

        foreach ($districts as $district) {
            $trust = $this->trust($district);

            if ($trust === 'excluded') {
                $excluded->push($this->excludedEntry($district, 'high_mismatch'));

                continue;
            }

            $assessment = $this->assess($district, $profile, $trust);

            if ($assessment === null) {
                $excluded->push($this->excludedEntry($district, 'not_enough_rain_years'));

                continue;
            }

            $ranking->push($assessment);
        }

        // The lower end of the uncertainty range decides the order, so a district that was good 10 of 10 times
        // ranks above one that was good 3 of 3 times. With equal evidence, a district whose satellite rain was
        // checked against households ranks above one that could not be checked.
        $ranking = $ranking
            ->sort(fn (array $a, array $b) => [$b['best']['good']['low'], $b['best']['good']['count'], $this->trustOrder($a['trust']), $a['best']['poor'], $a['name']]
                <=> [$a['best']['good']['low'], $a['best']['good']['count'], $this->trustOrder($b['trust']), $b['best']['poor'], $b['name']])
            ->values()
            ->map(fn (array $entry, int $index) => ['rank' => $index + 1] + $entry);

        return [
            'crop' => Arr::only($profile, ['id', 'name', 'cycle_months', 'good_mm', 'fail_mm', 'min_monthly_mm', 'flowering_month', 'flowering_min_mm', 'usual_planting_months', 'note']),
            'period' => $this->period($districts),
            'ranking' => $ranking->all(),
            'excluded' => $excluded->values()->all(),
        ];
    }

    /**
     * The same assessment for one district and one crop (used when a single district is asked about).
     */
    public function forDistrict(string $cropId, string $districtName, ?Collection $districts = null): ?array
    {
        $result = $this->forCrop($cropId, $districts);

        if ($result === null) {
            return null;
        }

        $name = mb_strtolower($districtName);

        return collect($result['ranking'])->first(fn (array $row) => mb_strtolower($row['name']) === $name)
            ?? collect($result['excluded'])->first(fn (array $row) => mb_strtolower($row['name']) === $name);
    }

    /**
     * How far the satellite can be trusted in a district, from the mismatch risk:
     * low risk is "verified", medium is "usable", high is "excluded", and no household value is "unverified".
     */
    public function trust(array $district): string
    {
        return match ($district['summary']['risk_level'] ?? 'no_data') {
            'low' => 'verified',
            'medium' => 'usable',
            'high' => 'excluded',
            default => 'unverified',
        };
    }

    /** @return array<string, mixed>|null */
    private function assess(array $district, array $profile, string $trust): ?array
    {
        $rain = $this->rainByMonthIndex($district['rainfall']);

        if ($rain === []) {
            return null;
        }

        $firstYear = intdiv(min(array_keys($rain)), 12);
        $lastYear = intdiv(max(array_keys($rain)), 12);
        $usual = $profile['usual_planting_months'];

        $byMonth = collect(range(1, 12))->map(function (int $month) use ($rain, $profile, $firstYear, $lastYear, $usual) {
            $seasons = collect(range($firstYear, $lastYear))
                ->map(fn (int $year) => $this->season($rain, $profile, $year, $month))
                ->filter()
                ->values();

            $count = fn (string $verdict) => $seasons->where('verdict', $verdict)->count();

            return [
                'month' => $month,
                'name' => self::MONTHS[$month],
                'usual' => in_array($month, $usual, true),
                'years' => $seasons->count(),
                'good' => ChanceEstimator::share($count('good'), $seasons->count()),
                'workable' => ChanceEstimator::share($count('good') + $count('marginal'), $seasons->count()),
                'marginal' => $count('marginal'),
                'poor' => $count('poor'),
                'average_season_mm' => $seasons->isNotEmpty() ? round($seasons->avg('total_mm'), 1) : null,
                'seasons' => $seasons->all(),
            ];
        });

        $best = $byMonth
            ->filter(fn (array $row) => $row['usual'] && $row['years'] > 0)
            ->sort(fn (array $a, array $b) => [$b['good']['low'], $b['good']['count'], $a['poor']] <=> [$a['good']['low'], $a['good']['count'], $b['poor']])
            ->first();

        if ($best === null) {
            return null;
        }

        $summary = $district['summary'];

        return [
            'id' => $district['id'],
            'name' => $district['name'],
            'province' => $district['province'],
            'trust' => $trust,
            'confidence' => $this->confidence($trust, $best['years']),
            'risk_level' => $summary['risk_level'] ?? 'no_data',
            'direction' => $summary['direction'] ?? null,
            'basis_risk_pct' => $summary['basis_risk_pct'] ?? null,
            'household_drought_pct' => $district['household_drought_pct'],
            'caveat' => $this->caveat($summary['direction'] ?? null, $trust),
            'best' => $this->monthRow($best, $profile),
            'by_month' => $byMonth->map(fn (array $row) => Arr::except($this->monthRow($row, $profile), ['seasons']))->all(),
        ];
    }

    /** The planting window of one year: the months of rain it had and whether the crop would have had enough. */
    private function season(array $rain, array $profile, int $year, int $startMonth): ?array
    {
        $start = $year * 12 + $startMonth - 1;
        $monthly = [];

        for ($i = 0; $i < $profile['cycle_months']; $i++) {
            if (! isset($rain[$start + $i])) {
                return null;
            }

            $monthly[] = $rain[$start + $i];
        }

        $judged = $this->judge($monthly, $profile, $startMonth);
        $end = $start + $profile['cycle_months'] - 1;

        return [
            'year' => $year,
            'label' => substr(self::MONTHS[$startMonth], 0, 3).' '.$year.' to '.substr(self::MONTHS[$end % 12 + 1], 0, 3).' '.intdiv($end, 12),
            'monthly_mm' => $monthly,
            'total_mm' => round(array_sum($monthly), 1),
        ] + $judged;
    }

    /**
     * Would this crop have had the rain it needs? Three checks (season total, dry months, flowering month) plus
     * very wet months; the verdict is the worst of them.
     *
     * @param  array<int, float>  $monthly  rain in each month of the cycle, in order
     * @return array{verdict: string, reasons: array<int, string>}
     */
    public function judge(array $monthly, array $profile, int $startMonth): array
    {
        $severity = 0;
        $reasons = [];
        $monthName = fn (int $i) => self::MONTHS[($startMonth - 1 + $i) % 12 + 1];
        $total = array_sum($monthly);
        [$goodMin, $goodMax] = $profile['good_mm'];
        [$failMin, $failMax] = $profile['fail_mm'];

        if ($total < $goodMin) {
            $severity = max($severity, $total < $failMin ? 2 : 1);
            $reasons[] = 'Season rain was '.round($total).' mm, below the '.$goodMin.' mm this crop needs.';
        } elseif ($total > $goodMax) {
            $severity = max($severity, $total > $failMax ? 2 : 1);
            $reasons[] = 'Season rain was '.round($total).' mm, above the '.$goodMax.' mm this crop copes with.';
        }

        $growing = $profile['cycle_months'] - $profile['ripening_months'];
        $dry = collect(array_slice($monthly, 0, $growing))
            ->filter(fn ($mm) => $mm < $profile['min_monthly_mm'])
            ->map(fn ($mm, $i) => $monthName($i).' ('.round($mm).' mm)');

        if ($dry->isNotEmpty()) {
            $severity = max($severity, $dry->count() >= 2 ? 2 : 1);
            $reasons[] = 'Under '.$profile['min_monthly_mm'].' mm in '.$dry->implode(', ').' while the crop was growing.';
        }

        $flowering = $monthly[$profile['flowering_month'] - 1] ?? null;

        if ($flowering !== null && $flowering < $profile['flowering_min_mm']) {
            $severity = max($severity, $flowering < $profile['flowering_fail_mm'] ? 2 : 1);
            $reasons[] = 'Only '.round($flowering).' mm in the flowering month ('.$monthName($profile['flowering_month'] - 1).').';
        }

        $wet = collect(array_slice($monthly, 0, $growing))->filter(fn ($mm) => $mm > $profile['wet_month_mm']);

        if ($wet->isNotEmpty()) {
            $severity = max($severity, 1);
            $reasons[] = 'A very wet month (over '.$profile['wet_month_mm'].' mm) risks waterlogging and disease.';
        }

        return ['verdict' => ['good', 'marginal', 'poor'][$severity], 'reasons' => $reasons];
    }

    /** The planting month as shown to the user, with when to harvest. */
    private function monthRow(array $row, array $profile): array
    {
        $harvestMonth = ($row['month'] - 1 + $profile['cycle_months'] - 1) % 12 + 1;

        return $row + ['harvest_month' => $harvestMonth, 'harvest_name' => self::MONTHS[$harvestMonth]];
    }

    /** Lower sorts first: with equal evidence a verified district outranks a usable one, and that an unverified one. */
    private function trustOrder(string $trust): int
    {
        return ['verified' => 0, 'usable' => 1, 'unverified' => 2][$trust] ?? 3;
    }

    private function confidence(string $trust, int $years): string
    {
        return match (true) {
            $trust === 'verified' && $years >= 10 => 'high',
            in_array($trust, ['verified', 'usable'], true) && $years >= 8 => 'medium',
            default => 'low',
        };
    }

    private function caveat(?string $direction, string $trust): ?string
    {
        if ($trust === 'unverified') {
            return 'No household survey value for this district, so the satellite could not be checked against what households reported.';
        }

        return match ($direction) {
            'satellite_understates' => 'Households here report more drought than the satellite shows, so the real chance of a good season may be lower than this.',
            'satellite_overstates' => 'The satellite shows more drought than households report, so the real chance of a good season may be higher than this.',
            default => null,
        };
    }

    private function excludedEntry(array $district, string $why): array
    {
        $summary = $district['summary'];

        return [
            'id' => $district['id'],
            'name' => $district['name'],
            'province' => $district['province'],
            'why' => $why,
            'risk_level' => $summary['risk_level'] ?? 'no_data',
            'direction' => $summary['direction'] ?? null,
            'basis_risk_pct' => $summary['basis_risk_pct'] ?? null,
            'household_drought_pct' => $district['household_drought_pct'],
            'reason' => $why === 'high_mismatch'
                ? 'Households and the satellite disagree strongly here (mismatch '.$summary['basis_risk_pct'].' points), so the satellite rainfall is not trusted and no prediction is made.'
                : 'There are not enough years of satellite rainfall to judge a full planting window.',
        ];
    }

    /** Satellite rainfall as month index (year * 12 + month - 1) => millimetres. */
    private function rainByMonthIndex(Collection $series): array
    {
        $rain = [];

        foreach ($series as $month) {
            $rain[$month['year'] * 12 + $month['month'] - 1] = (float) $month['rainfall_mm'];
        }

        return $rain;
    }

    public function period(Collection $districts): array
    {
        $years = $districts->pluck('rainfall')->flatten(1)->pluck('year');

        return ['first_year' => $years->min(), 'last_year' => $years->max()];
    }
}
