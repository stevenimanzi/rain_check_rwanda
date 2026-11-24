<?php

namespace App\Http\Middleware;

use App\Support\HouseholdSurveyImporterAccess;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class RequireHouseholdSurveyImportLogin
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! is_string($token) || ! Cache::has(HouseholdSurveyImporterAccess::cacheKey($token))) {
            abort(401, 'Your sign-in is invalid or has expired. Please sign in again.');
        }

        return $next($request);
    }
}
