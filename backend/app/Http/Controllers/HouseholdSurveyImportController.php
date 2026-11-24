<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HouseholdSurveyImportController extends Controller
{
    public function index(): JsonResponse
    {
        $imports = HouseholdSurveyImport::query()
            ->with('observations.district:id,name')
            ->orderByDesc('survey_year')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $imports->map(fn (HouseholdSurveyImport $import) => $this->formatImport($import))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'survey_year' => ['required', 'integer', 'between:1900,2100'],
            'source_name' => ['required', 'string', 'max:120'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:1024'],
        ]);

        $file = $validated['file'];
        $observations = $this->parseCsv($file);
        $fileHash = hash_file('sha256', $file->getRealPath());

        if ($fileHash === false) {
            throw ValidationException::withMessages([
                'file' => 'The uploaded CSV could not be read.',
            ]);
        }

        $sourceName = trim($validated['source_name']);
        $surveyYear = (int) $validated['survey_year'];

        if (HouseholdSurveyImport::query()
            ->where('survey_year', $surveyYear)
            ->where('source_name', $sourceName)
            ->where('file_sha256', $fileHash)
            ->exists()) {
            abort(409, 'This file has already been imported for this source and year.');
        }

        $import = DB::transaction(function () use ($file, $fileHash, $observations, $sourceName, $surveyYear) {
            $import = HouseholdSurveyImport::create([
                'survey_year' => $surveyYear,
                'source_name' => $sourceName,
                'original_filename' => Str::limit($file->getClientOriginalName(), 255, ''),
                'file_sha256' => $fileHash,
            ]);

            $import->observations()->createMany($observations);

            return $import->load('observations.district:id,name');
        });

        return response()->json(['data' => $this->formatImport($import)], 201);
    }

    /**
     * @return array<int, array{district_id: int, household_drought_pct: float}>
     */
    private function parseCsv(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'r');

        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => 'The uploaded CSV could not be read.',
            ]);
        }

        try {
            $header = fgetcsv($handle, null, ',', '"', '');

            if ($header === false) {
                throw ValidationException::withMessages(['file' => 'The CSV is empty.']);
            }

            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
            $header = array_map(fn ($column) => strtolower(trim((string) $column)), $header);

            if (count($header) !== count(array_unique($header))
                || ! in_array('district', $header, true)
                || ! in_array('household_drought_pct', $header, true)) {
                throw ValidationException::withMessages([
                    'file' => 'CSV headers must include district and household_drought_pct, each exactly once.',
                ]);
            }

            $districtIds = District::query()
                ->pluck('id', 'name')
                ->mapWithKeys(fn ($id, $name) => [strtolower(trim($name)) => (int) $id]);
            $seen = [];
            $observations = [];
            $rowNumber = 1;

            while (($line = fgetcsv($handle, null, ',', '"', '')) !== false) {
                $rowNumber++;

                if ($line === [null] || count(array_filter($line, fn ($value) => trim((string) $value) !== '')) === 0) {
                    continue;
                }

                if (count($line) > count($header)
                    && count(array_filter(array_slice($line, count($header)), fn ($value) => trim((string) $value) !== '')) > 0) {
                    throw ValidationException::withMessages([
                        'file' => "CSV row {$rowNumber} contains more fields than the header.",
                    ]);
                }

                $row = array_combine($header, array_slice(array_pad($line, count($header), ''), 0, count($header)));
                $districtName = trim((string) $row['district']);
                $percentage = trim((string) $row['household_drought_pct']);

                if ($percentage === '') {
                    continue;
                }

                $districtId = $districtIds[strtolower($districtName)] ?? null;

                if ($districtId === null) {
                    throw ValidationException::withMessages([
                        'file' => "CSV row {$rowNumber} has an unknown district: {$districtName}.",
                    ]);
                }

                if (isset($seen[$districtId])) {
                    throw ValidationException::withMessages([
                        'file' => "CSV row {$rowNumber} repeats district {$districtName}.",
                    ]);
                }

                if (! preg_match('/^\d{1,3}(?:\.\d{1,2})?$/D', $percentage)) {
                    throw ValidationException::withMessages([
                        'file' => "CSV row {$rowNumber} must have a number with at most two decimal places.",
                    ]);
                }

                if ((float) $percentage > 100) {
                    throw ValidationException::withMessages([
                        'file' => "CSV row {$rowNumber} must have a percentage between 0 and 100.",
                    ]);
                }

                $seen[$districtId] = true;
                $observations[] = [
                    'district_id' => $districtId,
                    'household_drought_pct' => (float) $percentage,
                ];
            }

            if ($observations === []) {
                throw ValidationException::withMessages([
                    'file' => 'The CSV must contain at least one district with a percentage.',
                ]);
            }

            return $observations;
        } finally {
            fclose($handle);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function formatImport(HouseholdSurveyImport $import): array
    {
        return [
            'id' => (int) $import->id,
            'survey_year' => (int) $import->survey_year,
            'source_name' => $import->source_name,
            'original_filename' => $import->original_filename,
            'created_at' => $import->created_at?->toISOString(),
            'observations' => $import->observations->map(fn ($observation) => [
                'district_id' => (int) $observation->district_id,
                'district_name' => $observation->district->name,
                'household_drought_pct' => (float) $observation->household_drought_pct,
            ])->values(),
        ];
    }
}
