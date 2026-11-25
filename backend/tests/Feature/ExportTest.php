<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\RainfallRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_rainfall_export_contains_only_the_configured_comparison_period(): void
    {
        $district = District::create([
            'name' => 'Huye',
            'province' => 'Southern Province',
            'household_drought_pct' => 31,
        ]);

        foreach ([
            [2022, 4, 75],
            [2023, 4, 100],
            [2024, 4, 150],
            [2022, 3, 100],
            [2023, 3, 110],
            [2024, 3, 125],
        ] as [$year, $month, $rainfall]) {
            RainfallRecord::create([
                'district_id' => $district->id,
                'year' => $year,
                'month' => $month,
                'rainfall_mm' => $rainfall,
            ]);
        }

        $response = $this->get('/api/export/rainfall')->assertOk();
        $rows = array_map('str_getcsv', explode("\n", trim($response->streamedContent())));

        $this->assertSame(
            ['district', 'year', 'month', 'rainfall_mm', 'normal_mm', 'deficit_pct', 'judged', 'dry_month'],
            $rows[0],
        );
        $this->assertEquals([['Huye', '2023', '4'], ['Huye', '2024', '3']], array_map(
            fn (array $row) => array_slice($row, 0, 3),
            array_slice($rows, 1),
        ));
    }
}
