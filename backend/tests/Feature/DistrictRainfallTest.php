<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\RainfallRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DistrictRainfallTest extends TestCase
{
    use RefreshDatabase;

    public function test_rainfall_endpoint_returns_only_the_requested_district_series(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
        ]);
        District::create([
            'name' => 'Other District',
            'province' => 'Western',
        ]);

        foreach ([2014 => 10, 2015 => 20, 2016 => 30] as $year => $rainfall) {
            RainfallRecord::create([
                'district_id' => $district->id,
                'year' => $year,
                'month' => 1,
                'rainfall_mm' => $rainfall,
            ]);
        }

        $this->getJson("/api/districts/rainfall?ids[]={$district->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $district->id)
            ->assertJsonCount(3, 'data.0.rainfall')
            ->assertJsonPath('data.0.rainfall.0.year', 2014)
            ->assertJsonPath('data.0.rainfall.2.year', 2016);
    }

    public function test_overview_hides_the_removed_indicator_without_deleting_stored_data(): void
    {
        $district = District::create([
            'name' => 'Test District',
            'province' => 'Eastern',
            'poverty_rate' => 22.5,
        ]);

        $this->getJson('/api/overview')
            ->assertOk()
            ->assertJsonPath('districts.0.name', 'Test District')
            ->assertJsonMissingPath('districts.0.poverty_rate');

        $this->assertDatabaseHas('districts', [
            'id' => $district->id,
            'poverty_rate' => 22.5,
        ]);
    }
}
