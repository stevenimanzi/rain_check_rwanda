<?php

namespace App\Http\Controllers;

use App\Models\RainfallRecord;
use App\Services\DroughtMatchService;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    /**
     * Rainfall for the whole country: the average of all districts, month by month.
     */
    public function __invoke(DroughtMatchService $matcher): JsonResponse
    {
        $monthly = RainfallRecord::selectRaw('year, month, AVG(rainfall_mm) AS rainfall_mm')
            ->groupBy('year', 'month')
            ->get();

        return response()->json([
            'national' => $matcher->rainfallSeries($monthly),
            'survey' => [
                'start' => config('raincheck.survey_start'),
                'end' => config('raincheck.survey_end'),
            ],
        ]);
    }
}
