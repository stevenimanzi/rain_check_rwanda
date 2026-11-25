<?php

namespace App\Http\Controllers;

use App\Models\HouseholdSurveyImport;
use App\Services\SatelliteRainfall;
use App\Support\HouseholdSurveyImporterAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Gets the satellite rainfall for a survey's period, one month per request so each request stays short.
 * The browser calls it again until the period is complete.
 */
class SatelliteRainfallController extends Controller
{
    public function __invoke(Request $request, SatelliteRainfall $satellite): JsonResponse
    {
        $surveyYear = (int) $request->validate([
            // CHIRPS maps start in 1981, so the first possible April to March period ends in 1982.
            'survey_year' => ['required', 'integer', 'between:1982,2100'],
        ])['survey_year'];

        // Downloads are only started for a saved survey, or by someone signed in to import one.
        $token = $request->bearerToken();
        $signedIn = is_string($token) && Cache::has(HouseholdSurveyImporterAccess::cacheKey($token));

        if (! $signedIn && ! HouseholdSurveyImport::where('survey_year', $surveyYear)->exists()) {
            return response()->json(['message' => 'Sign in to get satellite data for a survey that is not saved.'], 401);
        }

        set_time_limit(180);

        $window = $satellite->windowFor($surveyYear);
        $total = count($satellite->monthsIn($window));

        if ($satellite->storedDataCovers($window)) {
            return $this->progress($window, $total, [], 'complete');
        }

        $missing = $satellite->missingMonths($window);

        if (! $missing) {
            return $this->progress($window, $total, [], 'complete');
        }

        [$year, $month] = array_map('intval', explode('-', $missing[0]));

        try {
            $published = $satellite->fetchMonth($year, $month);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'The satellite data could not be downloaded right now. Please try again in a few minutes.',
            ], 502);
        }

        // Months are published in order, so when the earliest missing one is not out, neither are the later ones.
        if (! $published) {
            return $this->progress($window, $total, $missing, 'not_published');
        }

        $missing = array_slice($missing, 1);

        return $this->progress($window, $total, $missing, $missing ? 'fetching' : 'complete', sprintf('%04d-%02d', $year, $month));
    }

    private function progress(array $window, int $total, array $missing, string $status, ?string $fetched = null): JsonResponse
    {
        return response()->json(['data' => [
            'window' => $window,
            'status' => $status,
            'total' => $total,
            'available' => $total - count($missing),
            'missing_months' => $missing,
            'fetched' => $fetched,
        ]]);
    }
}
