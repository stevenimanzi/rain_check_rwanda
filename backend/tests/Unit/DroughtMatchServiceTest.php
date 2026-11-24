<?php

namespace Tests\Unit;

use App\Services\DroughtMatchService;
use Tests\TestCase;

class DroughtMatchServiceTest extends TestCase
{
    public function test_median_normal_rounds_exact_half_tenths_up(): void
    {
        $series = app(DroughtMatchService::class)->rainfallSeries(collect([
            (object) ['year' => 2014, 'month' => 2, 'rainfall_mm' => 80.0],
            (object) ['year' => 2015, 'month' => 2, 'rainfall_mm' => 50.0],
            (object) ['year' => 2016, 'month' => 2, 'rainfall_mm' => 59.6],
            (object) ['year' => 2017, 'month' => 2, 'rainfall_mm' => 65.1],
            (object) ['year' => 2018, 'month' => 2, 'rainfall_mm' => 70.0],
        ]));

        $this->assertSame(62.4, $series->firstWhere('year', 2014)['normal_mm']);
    }
}
