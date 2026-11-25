<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
class CropSuitability
{
    private const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    private const SEVERITY = ['good' => 0, 'marginal' => 1, 'poor' => 2];

    public function __construct(private DistrictAnalysis $analysis) {}

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
                $excluded->push($this->excludedEntry($district, 'not_enough_rain'));

                continue;
            }

            $ranking->push($assessment);
        }

        // A normal year that suits the crop comes first, then the observed season, then fewer households
        // reporting drought, then a satellite that was checked against households.
        $ranking = $ranking
            ->sort(fn (array $a, array $b) => $this->rankKey($a) <=> $this->rankKey($b))
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

    /** @return array<string, mixed>|null */
    private function assess(array $district, array $profile, string $trust): ?array
    {
        $observed = [];
        $normal = [];

        foreach ($district['rainfall'] as $month) {
            $observed[$month['year'] * 12 + $month['month'] - 1] = (float) $month['rainfall_mm'];

            if (($month['normal_mm'] ?? null) !== null) {
                $normal[$month['month']] = (float) $month['normal_mm'];
            }
        }

        if ($observed === []) {
            return null;
        }

        $byMonth = collect(range(1, 12))->map(fn (int $month) => $this->plantingMonth($month, $observed, $normal, $profile));

        $best = $byMonth
            ->filter(fn (array $row) => $row['usual'] && $row['typical'] !== null)
            ->sort(fn (array $a, array $b) => $this->monthKey($a, $profile) <=> $this->monthKey($b, $profile))
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
            // One observed season can never give high confidence; it is medium only where households agree with the satellite.
            'confidence' => $trust === 'verified' ? 'medium' : 'low',
            'risk_level' => $summary['risk_level'] ?? 'no_data',
            'direction' => $summary['direction'] ?? null,
            'basis_risk_pct' => $summary['basis_risk_pct'] ?? null,
            'household_drought_pct' => $district['household_drought_pct'],
            'caveat' => $this->caveat($summary['direction'] ?? null, $trust),
            'best' => $best,
            'by_month' => $byMonth->all(),
        ];
    }

    /**
     * One planting month: the normal year and, when the whole cycle fits inside the observed window, that season.
     *
     * @param  array<int, float>  $observed  month index (year * 12 + month - 1) => mm
     * @param  array<int, float>  $normal  calendar month => normal mm
     */
    private function plantingMonth(int $month, array $observed, array $normal, array $profile): array
    {
        $cycle = $profile['cycle_months'];
        $harvest = ($month - 1 + $cycle - 1) % 12 + 1;

        $typicalMonthly = [];

        for ($i = 0; $i < $cycle; $i++) {
            $value = $normal[($month - 1 + $i) % 12 + 1] ?? null;

            if ($value === null) {
                $typicalMonthly = null;
                break;
            }

            $typicalMonthly[] = $value;
        }

        $seen = null;

        foreach (array_unique(array_map(fn (int $index) => intdiv($index, 12), array_keys($observed))) as $year) {
            $seen = $this->observedSeason($observed, $profile, $year, $month);

            if ($seen !== null) {
                break;
            }
        }

        return [
            'month' => $month,
            'name' => self::MONTHS[$month],
            'usual' => in_array($month, $profile['usual_planting_months'], true),
            'harvest_month' => $harvest,
            'harvest_name' => self::MONTHS[$harvest],
            'typical' => $typicalMonthly === null ? null : $this->season($typicalMonthly, $profile, $month),
            'observed' => $seen,
        ];
    }

    private function observedSeason(array $observed, array $profile, int $year, int $startMonth): ?array
    {
        $start = $year * 12 + $startMonth - 1;
        $monthly = [];

        for ($i = 0; $i < $profile['cycle_months']; $i++) {
            if (! isset($observed[$start + $i])) {
                return null;
            }

            $monthly[] = $observed[$start + $i];
        }

        $end = $start + $profile['cycle_months'] - 1;

        return $this->season($monthly, $profile, $startMonth) + [
            'label' => substr(self::MONTHS[$startMonth], 0, 3).' '.$year.' to '.substr(self::MONTHS[$end % 12 + 1], 0, 3).' '.intdiv($end, 12),
        ];
    }

    /** Rain over a cycle, as a share of the crop's minimum need, and whether it was enough. */
    private function season(array $monthly, array $profile, int $startMonth): array
    {
        $total = round(array_sum($monthly), 1);

        return [
            'monthly_mm' => array_map(fn ($mm) => round($mm, 1), $monthly),
            'total_mm' => $total,
            // 100% means exactly the least rain the crop needs; above 100% is more than that.
            'need_pct' => (int) round($total / $profile['good_mm'][0] * 100),
        ] + $this->judge($monthly, $profile, $startMonth);
    }

    /** Lower sorts first: best typical verdict, best observed verdict, then rain closest to the middle of the ideal range. */
    private function monthKey(array $row, array $profile): array
    {
        $middle = array_sum($profile['good_mm']) / 2;

        return [
            self::SEVERITY[$row['typical']['verdict']],
            $row['observed'] ? self::SEVERITY[$row['observed']['verdict']] : 1,
            abs($row['typical']['total_mm'] - $middle),
        ];
    }

    private function rankKey(array $row): array
    {
        return [
            self::SEVERITY[$row['best']['typical']['verdict']],
            $row['best']['observed'] ? self::SEVERITY[$row['best']['observed']['verdict']] : 1,
            $row['household_drought_pct'] ?? 100.0,
            $this->trustOrder($row['trust']),
            $row['name'],
        ];
    }

    /** Lower sorts first: with equal evidence a verified district outranks a usable one, and that an unverified one. */
    private function trustOrder(string $trust): int
    {
        return ['verified' => 0, 'usable' => 1, 'unverified' => 2][$trust] ?? 3;
    }

    private function caveat(?string $direction, string $trust): ?string
    {
        if ($trust === 'unverified') {
            return 'No household survey value for this district, so the satellite could not be checked against what households reported.';
        }

        return match ($direction) {
            'satellite_understates' => 'Households here report more drought than the satellite shows, so the rain may suit the crop less than this says.',
            'satellite_overstates' => 'The satellite shows more drought than households report, so the rain may suit the crop better than this says.',
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
                : 'There is no satellite rainfall to judge a planting window.',
        ];
    }

    /** The months of observed rain in the database, for example April 2023 to March 2024. */
    public function period(Collection $districts): array
    {
        $months = $districts->pluck('rainfall')->flatten(1)->map(fn (array $m) => $m['year'] * 12 + $m['month'] - 1);

        if ($months->isEmpty()) {
            return ['first' => null, 'last' => null, 'label' => 'no rainfall'];
        }

        $label = fn (int $index) => self::MONTHS[$index % 12 + 1].' '.intdiv($index, 12);

        return ['first' => $label($months->min()), 'last' => $label($months->max()), 'label' => $label($months->min()).' to '.$label($months->max())];
    }
}
