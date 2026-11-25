<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use App\Models\RainfallRecord;
use App\Models\SatelliteRainfallRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeChirpsMap;
use Tests\TestCase;

class SatelliteRainfallTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int, District> */
    private array $districts;

    private array $files = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-25');
        $this->districts = [
            District::create(['name' => 'Huye', 'province' => 'Southern Province', 'household_drought_pct' => 31]),
            District::create(['name' => 'Gasabo', 'province' => 'Kigali City', 'household_drought_pct' => 8]),
        ];

        $square = fn (string $name, float $west) => [
            'properties' => ['shapeName' => $name],
            'geometry' => ['type' => 'Polygon', 'coordinates' => [[
                [$west, -0.4], [$west + 0.2, -0.4], [$west + 0.2, -0.2], [$west, -0.2], [$west, -0.4],
            ]]],
        ];
        $boundaries = $this->file(json_encode(['features' => [$square('Huye', 28.1), $square('Gasabo', 28.6)]]));

        $normals = "district,month,normal_mm,years\n";
        foreach (['Huye', 'Gasabo'] as $name) {
            foreach (range(1, 12) as $month) {
                $normals .= "{$name},{$month},100,11\n";
            }
        }

        config([
            'raincheck.boundaries_file' => $boundaries,
            'raincheck.satellite_normals_file' => $this->file($normals),
        ]);
    }

    protected function tearDown(): void
    {
        array_map('unlink', $this->files);

        parent::tearDown();
    }

    private function file(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'rc');
        file_put_contents($path, $contents);

        return $this->files[] = $path;
    }

    private function saveSurvey(int $year): void
    {
        HouseholdSurveyImport::create([
            'survey_year' => $year,
            'source_name' => 'Sample survey',
            'original_filename' => 'sample.csv',
            'file_sha256' => str_repeat('a', 64),
        ]);
    }

    private function fakeMaps(): void
    {
        // Huye is very dry (50 mm against a normal of 100), Gasabo is normal.
        Http::fake(['data.chc.ucsb.edu/*' => Http::response(FakeChirpsMap::build([[50.0, 100.0]]))]);
    }

    public function test_each_request_fetches_one_month_until_the_survey_period_is_complete(): void
    {
        $this->saveSurvey(2026);
        $this->fakeMaps();

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])
            ->assertOk()
            ->assertJsonPath('data.window.start', '2025-04')
            ->assertJsonPath('data.window.end', '2026-03')
            ->assertJsonPath('data.fetched', '2025-04')
            ->assertJsonPath('data.available', 1)
            ->assertJsonPath('data.status', 'fetching');

        foreach (range(2, 12) as $available) {
            $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])
                ->assertOk()
                ->assertJsonPath('data.available', $available);
        }

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])->assertJsonPath('data.status', 'complete');

        Http::assertSentCount(12);
        $this->assertSame(24, SatelliteRainfallRecord::count());
        // The project's own rainfall is never touched.
        $this->assertSame(0, RainfallRecord::count());

        $comparison = $this->postJson('/api/survey-comparison', [
            'survey_year' => 2026,
            'view' => 'imported',
            'observations' => [
                ['district_id' => $this->districts[0]->id, 'household_drought_pct' => 40],
                ['district_id' => $this->districts[1]->id, 'household_drought_pct' => 5],
            ],
        ])->assertOk()->assertJsonPath('data.window.complete', true);

        $months = collect($comparison->json('data.districts'))->pluck('summary.satellite_drought_months', 'name');
        $this->assertSame(12, $months['Huye']);
        $this->assertSame(0, $months['Gasabo']);

        $this->getJson('/api/districts/rainfall?ids[]='.$this->districts[0]->id.'&start=2025-04&end=2026-03')
            ->assertOk()
            ->assertJsonCount(12, 'data.0.rainfall')
            ->assertJsonPath('data.0.rainfall.0.satellite_drought', true);
    }

    public function test_only_the_needed_parts_of_a_map_are_downloaded(): void
    {
        $this->saveSurvey(2026);
        $map = FakeChirpsMap::build([[50.0, 100.0]]);

        Http::fake(['data.chc.ucsb.edu/*' => function ($request) use ($map) {
            preg_match('/bytes=(\d+)-(\d+)/', $request->header('Range')[0], $range);

            return Http::response(substr($map, (int) $range[1], $range[2] - $range[1] + 1), 206);
        }]);

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])->assertJsonPath('data.fetched', '2025-04');

        // The header, the index at the end of the file and the rows over the districts.
        Http::assertSentCount(3);
        $this->assertEqualsWithDelta(50.0, (float) SatelliteRainfallRecord::orderBy('district_id')->value('rainfall_mm'), 0.001);
    }

    public function test_months_that_are_not_published_yet_are_reported(): void
    {
        $this->saveSurvey(2026);
        Http::fake(['data.chc.ucsb.edu/*' => Http::response('Not found', 404)]);

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])
            ->assertOk()
            ->assertJsonPath('data.status', 'not_published')
            ->assertJsonPath('data.available', 0);
    }

    public function test_future_months_are_not_requested(): void
    {
        $this->saveSurvey(2028);
        Http::fake();

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2028])->assertJsonPath('data.status', 'not_published');

        Http::assertNothingSent();
    }

    public function test_a_period_the_project_already_covers_needs_no_download(): void
    {
        $this->saveSurvey(2024);
        Http::fake();

        foreach ($this->districts as $district) {
            foreach (range(0, 11) as $i) {
                $month = ($i + 3) % 12 + 1;
                RainfallRecord::create([
                    'district_id' => $district->id, 'year' => $month >= 4 ? 2023 : 2024, 'month' => $month,
                    'rainfall_mm' => 90,
                ]);
            }
        }

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2024])->assertJsonPath('data.status', 'complete');

        Http::assertNothingSent();
    }

    public function test_a_survey_that_is_not_saved_needs_a_sign_in(): void
    {
        Http::fake();

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])->assertUnauthorized();

        Http::assertNothingSent();
    }

    public function test_a_download_failure_gives_a_clear_message(): void
    {
        $this->saveSurvey(2026);
        Http::fake(['data.chc.ucsb.edu/*' => Http::response('broken', 500)]);

        $this->postJson('/api/satellite-rainfall', ['survey_year' => 2026])->assertStatus(502);

        $this->assertSame(0, SatelliteRainfallRecord::count());
    }
}
