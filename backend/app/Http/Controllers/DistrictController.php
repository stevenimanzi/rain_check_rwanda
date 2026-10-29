<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Services\DroughtMatchService;
use Illuminate\Http\JsonResponse;

class DistrictController extends Controller
{
    public function __construct(private DroughtMatchService $matcher)
    {
    }

    public function index(): JsonResponse
    {
        $districts = District::with(['rainfallRecords', 'droughtReports'])
            ->orderBy('name')
            ->get()
            ->map(fn (District $district) => $this->basicInfo($district) + [
                'summary' => $this->matcher->analyse($district)['summary'],
            ]);

        return response()->json(['data' => $districts]);
    }

    public function show(District $district): JsonResponse
    {
        $district->load(['rainfallRecords', 'droughtReports']);
        $analysis = $this->matcher->analyse($district);

        return response()->json([
            'data' => $this->basicInfo($district) + $analysis,
        ]);
    }

    private function basicInfo(District $district): array
    {
        return [
            'id' => $district->id,
            'name' => $district->name,
            'province' => $district->province,
            'poverty_rate' => $district->poverty_rate === null ? null : (float) $district->poverty_rate,
        ];
    }
}
