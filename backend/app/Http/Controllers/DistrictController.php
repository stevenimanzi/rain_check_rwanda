<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Services\DistrictAnalysis;
use Illuminate\Http\JsonResponse;

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

    public function show(District $district): JsonResponse
    {
        $found = $this->analysis->all()->firstWhere('id', $district->id);

        return response()->json(['data' => $found]);
    }
}
