<?php

namespace App\Services;

use App\Models\District;
use App\Models\DroughtReport;
use Illuminate\Support\Collection;

/**
 * Compares satellite rainfall with the droughts households report, month by month.
 */
class DroughtMatchService
{
    public function analyse(District $district): array
    {
        $rainfall = $district->rainfallRecords;
        $totals = $this->monthTotals($rainfall);
        $byMonth = $rainfall->keyBy(fn ($record) => $record->year * 100 + $record->month);

        $months = $district->droughtReports
            ->sortBy(fn (DroughtReport $report) => $report->year * 100 + $report->month)
            ->map(fn (DroughtReport $report) => $this->analyseMonth($report, $byMonth, $totals))
            ->filter()
            ->values();

        $series = $this->rainfallSeries($rainfall);

        return [
            'months' => $months,
            'rainfall' => $series,
            'summary' => $this->summarise($months) + [
                'satellite_drought_months' => $this->droughtMonthsInSurveyWindow($series),
            ],
        ];
    }

    /**
     * Monthly rainfall against the district's normal for that calendar month.
     */
    public function rainfallSeries(Collection $rainfall): Collection
    {
        $totals = $this->monthTotals($rainfall);

        return $rainfall
            ->sortBy(fn ($record) => $record->year * 100 + $record->month)
            ->map(function ($record) use ($totals) {
                $baseline = $this->normalRainfall($totals, $record->month, $record->rainfall_mm);

                if (! $baseline) {
                    return null;
                }

                $deficit = ($baseline - $record->rainfall_mm) / $baseline * 100;

                return [
                    'year' => $record->year,
                    'month' => $record->month,
                    'rainfall_mm' => round($record->rainfall_mm, 1),
                    'normal_mm' => round($baseline, 1),
                    'rainfall_deficit_pct' => round($deficit, 1),
                    'judged' => $baseline >= config('raincheck.minimum_normal_mm'),
                    'satellite_drought' => $this->isDrought($deficit, $baseline),
                ];
            })
            ->filter()
            ->values();
    }

    private function droughtMonthsInSurveyWindow(Collection $series): int
    {
        $start = config('raincheck.survey_start');
        $end = config('raincheck.survey_end');

        return $series
            ->filter(function (array $month) use ($start, $end) {
                $key = sprintf('%04d-%02d', $month['year'], $month['month']);

                return $key >= $start && $key <= $end && $month['satellite_drought'];
            })
            ->count();
    }

    /**
     * Rainfall added up for each calendar month across all years, so "normal" is a quick lookup.
     */
    private function monthTotals(Collection $rainfall): Collection
    {
        return $rainfall->groupBy('month')->map(fn (Collection $records) => [
            'sum' => $records->sum('rainfall_mm'),
            'count' => $records->count(),
        ]);
    }

    /**
     * Average rainfall for this calendar month in all the other years.
     */
    private function normalRainfall(Collection $totals, int $month, float $thisYearMm): ?float
    {
        $total = $totals->get($month);

        if (! $total || $total['count'] < 2) {
            return null;
        }

        return ($total['sum'] - $thisYearMm) / ($total['count'] - 1);
    }

    private function analyseMonth(DroughtReport $report, Collection $byMonth, Collection $totals): ?array
    {
        $actual = $byMonth->get($report->year * 100 + $report->month);

        if (! $actual) {
            return null;
        }

        $baseline = $this->normalRainfall($totals, $report->month, $actual->rainfall_mm);

        if (! $baseline || $report->households_surveyed === 0) {
            return null;
        }

        $deficit = ($baseline - $actual->rainfall_mm) / $baseline * 100;
        $reportedShare = $report->households_reporting_drought / $report->households_surveyed * 100;

        $satelliteDrought = $this->isDrought($deficit, $baseline);
        $reportedDrought = $reportedShare >= config('raincheck.reported_drought_threshold');

        return [
            'year' => $report->year,
            'month' => $report->month,
            'rainfall_mm' => round($actual->rainfall_mm, 1),
            'normal_mm' => round($baseline, 1),
            'rainfall_deficit_pct' => round($deficit, 1),
            'reported_drought_pct' => round($reportedShare, 1),
            'satellite_drought' => $satelliteDrought,
            'reported_drought' => $reportedDrought,
            'outcome' => $this->outcome($satelliteDrought, $reportedDrought),
        ];
    }

    /**
     * Months that are normally almost dry (the June-August dry season) are never counted,
     * because a few millimetres either way would look like a huge percentage swing.
     */
    private function isDrought(float $deficit, float $baseline): bool
    {
        return $baseline >= config('raincheck.minimum_normal_mm')
            && $deficit >= config('raincheck.rainfall_deficit_threshold');
    }

    private function outcome(bool $satellite, bool $reported): string
    {
        if ($satellite === $reported) {
            return 'match';
        }

        // Households had a drought but the index would not pay out.
        return $reported ? 'missed_payout' : 'false_payout';
    }

    private function summarise(Collection $months): array
    {
        $total = $months->count();

        if ($total === 0) {
            return ['months_tested' => 0, 'basis_risk_pct' => null, 'risk_level' => 'no_data'];
        }

        $mismatches = $months->where('outcome', '!=', 'match')->count();
        $basisRisk = round($mismatches / $total * 100, 1);

        return [
            'months_tested' => $total,
            'matches' => $months->where('outcome', 'match')->count(),
            'missed_payouts' => $months->where('outcome', 'missed_payout')->count(),
            'false_payouts' => $months->where('outcome', 'false_payout')->count(),
            'basis_risk_pct' => $basisRisk,
            'risk_level' => $this->riskLevel($basisRisk),
        ];
    }

    private function riskLevel(float $basisRisk): string
    {
        return match (true) {
            $basisRisk >= config('raincheck.basis_risk_high') => 'high',
            $basisRisk >= config('raincheck.basis_risk_medium') => 'medium',
            default => 'low',
        };
    }
}
