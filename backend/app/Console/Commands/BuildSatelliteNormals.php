<?php

namespace App\Console\Commands;

use App\Models\District;
use App\Services\SatelliteRainfall;
use Illuminate\Console\Command;

class BuildSatelliteNormals extends Command
{
    protected $signature = 'raincheck:satellite-normals {--from=2014} {--to=2024}';

    protected $description = 'Calculate normal rainfall per district and month from the official CHIRPS maps (downloads one map per month)';

    public function handle(SatelliteRainfall $satellite): int
    {
        $names = District::orderBy('name')->pluck('name', 'id');
        $values = [];

        for ($year = (int) $this->option('from'); $year <= (int) $this->option('to'); $year++) {
            for ($month = 1; $month <= 12; $month++) {
                $means = $satellite->districtMeans($year, $month);

                if ($means === null) {
                    $this->error(sprintf('No map is published for %04d-%02d; nothing was written.', $year, $month));

                    return self::FAILURE;
                }

                foreach ($means as $districtId => $rainfall) {
                    $values[$districtId][$month][] = $rainfall;
                }

                $this->line(sprintf('%04d-%02d done', $year, $month));
            }
        }

        $handle = fopen(config('raincheck.satellite_normals_file'), 'w');
        fputcsv($handle, ['district', 'month', 'normal_mm', 'years'], ',', '"', '', "\n");

        foreach ($names as $districtId => $name) {
            foreach ($values[$districtId] as $month => $years) {
                sort($years);
                $middle = intdiv(count($years), 2);
                $median = count($years) % 2 ? $years[$middle] : ($years[$middle - 1] + $years[$middle]) / 2;

                fputcsv($handle, [$name, $month, round($median, 2), count($years)], ',', '"', '', "\n");
            }
        }

        fclose($handle);
        $this->info('Normal rainfall written to '.config('raincheck.satellite_normals_file'));

        return self::SUCCESS;
    }
}
