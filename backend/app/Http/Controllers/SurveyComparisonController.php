<?php

namespace App\Http\Controllers;

use App\Services\DistrictAnalysis;
use App\Services\SatelliteRainfall;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Re-runs the satellite vs household comparison with another survey's values (a saved import or an
 * unsaved preview). Nothing is stored; the survey values come in the request.
 */
class SurveyComparisonController extends Controller
{
    public function __invoke(Request $request, DistrictAnalysis $analysis, SatelliteRainfall $satellite): JsonResponse
    {
        $validated = $request->validate([
            'survey_year' => ['required', 'integer', 'between:1900,2100'],
            'view' => ['required', 'in:merged,imported'],
            'observations' => ['present', 'array', 'max:200'],
            'observations.*.district_id' => ['required', 'integer', 'distinct', 'exists:districts,id'],
            'observations.*.household_drought_pct' => ['required', 'numeric', 'between:0,100'],
        ]);

        $surveyYear = (int) $validated['survey_year'];
        $window = $satellite->windowFor($surveyYear);

        $values = collect($validated['observations'])
            ->mapWithKeys(fn (array $row) => [(int) $row['district_id'] => (float) $row['household_drought_pct']])
            ->all();

        $districts = $analysis->all($values, $validated['view'] === 'imported', $window);
        $covered = $districts->isNotEmpty()
            && $districts->every(fn (array $district) => $district['summary']['satellite_window_months'] >= 12);

        return response()->json([
            'data' => [
                'window' => [
                    'start' => $window['start'],
                    'end' => $window['end'],
                    'complete' => $covered,
                ],
                'rank_correlation' => $analysis->rankCorrelation($districts),
                'districts' => $districts
                    ->map(fn (array $district) => collect($district)->except('rainfall')->all())
                    ->values(),
            ],
        ]);
    }
}
