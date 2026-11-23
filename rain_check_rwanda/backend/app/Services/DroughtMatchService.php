<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * Reads satellite rainfall: which months were dry, and how often a district is dry.
 */
class DroughtMatchService
{
    /**
     * Monthly rainfall against the normal for that calendar month.
     */
    public function rainfallSeries(Collection $rainfall): Collection
    {
        $valuesByMonth = $this->monthValues($rainfall);

        return $rainfall
            ->sortBy(fn ($record) => $record->year * 100 + $record->month)
            ->map(function ($record) use ($valuesByMonth) {
                $normal = $this->normalRainfall($valuesByMonth, $record->month, $record->rainfall_mm);

                if (! $normal) {
                    return null;
                }

                $deficit = ($normal - $record->rainfall_mm) / $normal * 100;

                return [
                    'year' => $record->year,
                    'month' => $record->month,
                    'rainfall_mm' => round($record->rainfall_mm, 1),
                    'normal_mm' => round($normal, 1),
                    'rainfall_deficit_pct' => round($deficit, 1),
                    'judged' => $normal >= config('raincheck.minimum_normal_mm'),
                    'satellite_drought' => $this->isDrought($deficit, $normal),
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * Long-term drought record: how often, in which months and in which years the satellite saw a dry month.
     */
    public function history(Collection $series): array
    {
        $judged = $series->where('judged', true);
        $dry = $judged->where('satellite_drought', true);
        $years = $series->pluck('year')->unique();

        return [
            'years_covered' => $years->count(),
            'dry_months' => $dry->count(),
            'dry_share_pct' => $judged->count() ? round($dry->count() / $judged->count() * 100, 1) : null,
            'avg_dry_months_per_year' => $years->count() ? round($dry->count() / $years->count(), 1) : null,
            'by_calendar_month' => collect(range(1, 12))->map(function (int $month) use ($judged) {
                $inMonth = $judged->where('month', $month);

                return [
                    'month' => $month,
                    'dry_pct' => $inMonth->count()
                        ? round($inMonth->where('satellite_drought', true)->count() / $inMonth->count() * 100, 1)
                        : null,
                ];
            })->values(),
            'by_year' => $years->sort()->map(fn ($year) => [
                'year' => $year,
                'dry_months' => $dry->where('year', $year)->count(),
            ])->values(),
        ];
    }

    /**
     * Number of dry months inside the comparison window (the 12 months households were asked about).
     */
    public function dryMonthsInWindow(Collection $series): int
    {
        $start = config('raincheck.comparison_start');
        $end = config('raincheck.comparison_end');

        return $series
            ->filter(function (array $month) use ($start, $end) {
                $key = sprintf('%04d-%02d', $month['year'], $month['month']);

                return $key >= $start && $key <= $end && $month['satellite_drought'];
            })
            ->count();
    }

    /**
     * Rainfall of every year for each calendar month, so "normal" is a quick lookup.
     */
    private function monthValues(Collection $rainfall): Collection
    {
        return $rainfall->groupBy('month')->map(
            fn (Collection $records) => $records->pluck('rainfall_mm')->map(fn ($mm) => (float) $mm)->values()
        );
    }

    /**
     * Normal rainfall for a calendar month: the typical (median) value of all the other years.
     * The median is used because a few very wet years would pull an average up and make
     * ordinary months look dry.
     */
    private function normalRainfall(Collection $valuesByMonth, int $month, float $thisYearMm): ?float
    {
        $others = $valuesByMonth->get($month)?->values();

        if (! $others) {
            return null;
        }

        $own = $others->search(fn (float $mm) => $mm === $thisYearMm);

        if ($own !== false) {
            $others->forget($own);
        }

        return $others->count() >= 2 ? $others->median() : null;
    }

    /**
     * Months that are normally almost dry (the June-August dry season) are never counted,
     * because a few millimetres either way would look like a huge percentage swing.
     */
    private function isDrought(float $deficit, float $normal): bool
    {
        return $normal >= config('raincheck.minimum_normal_mm')
            && $deficit >= config('raincheck.rainfall_deficit_threshold');
    }
}
