<?php

namespace App\Http\Controllers;

use App\Models\RainfallRecord;
use App\Services\DistrictAnalysis;
use App\Services\DroughtMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class OverviewController extends Controller
{
    public function __invoke(DroughtMatchService $matcher, DistrictAnalysis $analysis): JsonResponse
    {
        // Rainfall for the whole country: the average of all districts, month by month.
        $monthly = RainfallRecord::selectRaw('year, month, AVG(rainfall_mm) AS rainfall_mm')
            ->groupBy('year', 'month')
            ->get();

        $districts = $analysis->all();
        $histories = $districts->pluck('history');

        return response()->json([
            'national' => $matcher->rainfallSeries($monthly),
            'by_year' => $this->averageByYear($histories),
            'by_calendar_month' => $this->averageByCalendarMonth($histories),
            'rank_correlation' => $analysis->rankCorrelation($districts),
            'window' => [
                'start' => config('raincheck.comparison_start'),
                'end' => config('raincheck.comparison_end'),
            ],
            'settings' => [
                'rainfall_deficit_threshold' => config('raincheck.rainfall_deficit_threshold'),
                'minimum_normal_mm' => config('raincheck.minimum_normal_mm'),
                'basis_risk_medium' => config('raincheck.basis_risk_medium'),
                'basis_risk_high' => config('raincheck.basis_risk_high'),
            ],
        ]);
    }

    /**
     * For each year: the average number of dry months per district.
     */
    private function averageByYear(Collection $histories): Collection
    {
        return $histories
            ->flatMap(fn (array $history) => $history['by_year'])
            ->groupBy('year')
            ->map(fn (Collection $rows, $year) => [
                'year' => (int) $year,
                'dry_months' => round($rows->avg('dry_months'), 1),
            ])
            ->sortBy('year')
            ->values();
    }

    /**
     * For each calendar month: the average share of years in which a district was dry.
     */
    private function averageByCalendarMonth(Collection $histories): Collection
    {
        return $histories
            ->flatMap(fn (array $history) => $history['by_calendar_month'])
            ->groupBy('month')
            ->map(fn (Collection $rows, $month) => [
                'month' => (int) $month,
                'dry_pct' => $rows->whereNotNull('dry_pct')->count() ? round($rows->avg('dry_pct'), 1) : null,
            ])
            ->values();
    }
}
