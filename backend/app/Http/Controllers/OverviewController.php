<?php

namespace App\Http\Controllers;

use App\Models\RainfallRecord;
use App\Services\DistrictAnalysis;
use App\Services\DroughtMatchService;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    public function __invoke(DroughtMatchService $matcher, DistrictAnalysis $analysis): JsonResponse
    {
        // Rainfall for the whole country: the average of all districts, month by month.
        $monthly = RainfallRecord::selectRaw('year, month, AVG(rainfall_mm) AS rainfall_mm')
            ->groupBy('year', 'month')
            ->get();

        $districts = $analysis->all();
        $start = config('raincheck.comparison_start');
        $end = config('raincheck.comparison_end');
        $national = $matcher->rainfallSeries($monthly)
            ->filter(function (array $month) use ($start, $end) {
                $key = sprintf('%04d-%02d', $month['year'], $month['month']);

                return $key >= $start && $key <= $end;
            })->values();

        return response()->json([
            'districts' => $districts->map(fn (array $district) => collect($district)->except('rainfall')->all())->values(),
            'national' => $national,
            'rank_correlation' => $analysis->rankCorrelation($districts),
            'window' => [
                'start' => $start,
                'end' => $end,
            ],
            'settings' => [
                'rainfall_deficit_threshold' => config('raincheck.rainfall_deficit_threshold'),
                'minimum_normal_mm' => config('raincheck.minimum_normal_mm'),
                'basis_risk_medium' => config('raincheck.basis_risk_medium'),
                'basis_risk_high' => config('raincheck.basis_risk_high'),
            ],
        ]);
    }
}
