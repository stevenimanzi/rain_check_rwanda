<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSurveyImportToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.imports.token');
        $provided = $request->bearerToken();

        if ($expected === '') {
            abort(503, 'Survey imports are not configured.');
        }

        if (! is_string($provided) || ! hash_equals($expected, $provided)) {
            abort(401, 'Invalid import token.');
        }

        return $next($request);
    }
}
