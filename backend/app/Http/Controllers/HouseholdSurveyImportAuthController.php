<?php

namespace App\Http\Controllers;

use App\Support\HouseholdSurveyImporterAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class HouseholdSurveyImportAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:255'],
        ]);
        $configuredEmail = strtolower(trim((string) config('services.imports.email')));
        $configuredPassword = (string) config('services.imports.password');

        if ($configuredEmail === '' || $configuredPassword === '') {
            abort(503, 'Survey importer sign-in is not configured.');
        }

        if (! hash_equals($configuredEmail, strtolower(trim($credentials['email'])))
            || ! hash_equals($configuredPassword, $credentials['password'])) {
            return response()->json(['message' => 'Invalid email or password.'], 401);
        }

        $token = Str::random(64);
        Cache::put(
            HouseholdSurveyImporterAccess::cacheKey($token),
            true,
            now()->addHour(),
        );

        return response()->json([
            'data' => [
                'token' => $token,
                'expires_in' => 3600,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = (string) $request->bearerToken();
        Cache::forget(HouseholdSurveyImporterAccess::cacheKey($token));

        return response()->json(['message' => 'Signed out.']);
    }
}
