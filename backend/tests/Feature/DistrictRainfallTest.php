<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\RainfallRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DistrictRainfallTest extends TestCase
{
    use RefreshDatabase;

    public function test_rainfall_endpoint_returns_only_the_requested_district_and_comparison_period(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
        ]);
        District::create([
            'name' => 'Other District',
            'province' => 'Western',
        ]);

        foreach ([
            [2021, 4, 70],
            [2022, 4, 80],
            [2023, 4, 100],
            [2022, 3, 90],
            [2023, 3, 110],
            [2024, 3, 120],
        ] as [$year, $month, $rainfall]) {
            RainfallRecord::create([
                'district_id' => $district->id,
                'year' => $year,
                'month' => $month,
                'rainfall_mm' => $rainfall,
            ]);
        }

        $this->getJson("/api/districts/rainfall?ids[]={$district->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $district->id)
            ->assertJsonCount(2, 'data.0.rainfall')
            ->assertJsonPath('data.0.rainfall.0.year', 2023)
            ->assertJsonPath('data.0.rainfall.0.month', 4)
            ->assertJsonPath('data.0.rainfall.1.year', 2024)
            ->assertJsonPath('data.0.rainfall.1.month', 3);
    }

    public function test_rainfall_endpoint_can_return_a_different_complete_survey_period(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
        ]);

        foreach ([
            [2022, 4, 70],
            [2023, 4, 80],
            [2024, 4, 100],
            [2023, 3, 90],
            [2024, 3, 110],
            [2025, 3, 120],
        ] as [$year, $month, $rainfall]) {
            RainfallRecord::create([
                'district_id' => $district->id,
                'year' => $year,
                'month' => $month,
                'rainfall_mm' => $rainfall,
            ]);
        }

        $this->getJson("/api/districts/rainfall?ids[]={$district->id}&start=2024-04&end=2025-03")
            ->assertOk()
            ->assertJsonCount(2, 'data.0.rainfall')
            ->assertJsonPath('data.0.rainfall.0.year', 2024)
            ->assertJsonPath('data.0.rainfall.0.month', 4)
            ->assertJsonPath('data.0.rainfall.1.year', 2025)
            ->assertJsonPath('data.0.rainfall.1.month', 3);
    }

    public function test_rainfall_endpoint_rejects_an_incomplete_period(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
        ]);

        $this->getJson("/api/districts/rainfall?ids[]={$district->id}&start=2024-04")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('end');
    }

    public function test_overview_hides_the_removed_indicator_without_deleting_stored_data(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
            'poverty_rate' => 22.5,
        ]);

        foreach ([
            [2021, 4, 70],
            [2022, 4, 80],
            [2023, 4, 100],
            [2022, 3, 90],
            [2023, 3, 110],
            [2024, 3, 120],
        ] as [$year, $month, $rainfall]) {
            RainfallRecord::create([
                'district_id' => $district->id,
                'year' => $year,
                'month' => $month,
                'rainfall_mm' => $rainfall,
            ]);
        }

        $this->getJson('/api/overview')
            ->assertOk()
            ->assertJsonPath('districts.0.name', 'Test District')
            ->assertJsonMissingPath('districts.0.poverty_rate')
            ->assertJsonMissingPath('districts.0.history')
            ->assertJsonMissingPath('by_year')
            ->assertJsonMissingPath('by_calendar_month')
            ->assertJsonCount(2, 'national')
            ->assertJsonPath('national.0.year', 2023)
            ->assertJsonPath('national.0.month', 4);

        $this->assertDatabaseHas('districts', [
            'id' => $district->id,
            'poverty_rate' => 22.5,
        ]);
    }
}
