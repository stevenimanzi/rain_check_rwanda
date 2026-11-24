<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Services\DistrictAnalysis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DistrictController extends Controller
{
    public function __construct(private DistrictAnalysis $analysis)
    {
    }

    /**
     * All districts, without the monthly rainfall series (kept for the detail view).
     */
    public function index(): JsonResponse
    {
        $districts = $this->analysis->all()->map(fn (array $district) => collect($district)->except('rainfall')->all());

        return response()->json(['data' => $districts]);
    }

    public function rainfall(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer', 'distinct', 'exists:districts,id'],
        ]);

        return response()->json(['data' => $this->analysis->rainfall($validated['ids'])]);
    }

    public function show(District $district): JsonResponse
    {
        $found = $this->analysis->all()->firstWhere('id', $district->id);

        return response()->json(['data' => $found]);
    }
}
