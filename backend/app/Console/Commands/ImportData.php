<?php

namespace App\Console\Commands;

use App\Models\District;
use App\Models\DroughtReport;
use App\Models\RainfallRecord;
use Illuminate\Console\Command;

class ImportData extends Command
{
    protected $signature = 'raincheck:import {type : poverty, rainfall or reports} {file : path to a CSV file}';

    protected $description = 'Import poverty, rainfall or drought report data from a CSV file';

    /** Required CSV columns for each import type. */
    private const COLUMNS = [
        'poverty' => ['district', 'poverty_rate'],
        'rainfall' => ['district', 'year', 'month', 'rainfall_mm'],
        'reports' => ['district', 'year', 'month', 'households_surveyed', 'households_reporting_drought'],
    ];

    public function handle(): int
    {
        $type = $this->argument('type');
        $file = $this->argument('file');

        if (! isset(self::COLUMNS[$type])) {
            $this->error('Type must be poverty, rainfall or reports.');
            return self::FAILURE;
        }

        if (! is_readable($file)) {
            $this->error("Cannot read file: {$file}");
            return self::FAILURE;
        }

        $handle = fopen($file, 'r');
        $header = array_map('trim', fgetcsv($handle) ?: []);
        $missing = array_diff(self::COLUMNS[$type], $header);

        if ($missing) {
            $this->error('Missing columns: '.implode(', ', $missing));
            return self::FAILURE;
        }

        $districts = District::pluck('id', 'name')->mapWithKeys(fn ($id, $name) => [strtolower($name) => $id]);
        $imported = 0;
        $skipped = 0;

        while (($line = fgetcsv($handle)) !== false) {
            $row = array_combine($header, array_pad($line, count($header), null));
            $districtId = $districts[strtolower(trim($row['district']))] ?? null;

            if ($districtId === null) {
                $this->warn("Unknown district: {$row['district']}");
                $skipped++;
                continue;
            }

            $this->save($type, $districtId, $row);
            $imported++;
        }

        fclose($handle);
        $this->info("Imported {$imported} rows, skipped {$skipped}.");

        return self::SUCCESS;
    }

    private function save(string $type, int $districtId, array $row): void
    {
        $key = ['district_id' => $districtId, 'year' => (int) ($row['year'] ?? 0), 'month' => (int) ($row['month'] ?? 0)];

        match ($type) {
            'poverty' => District::whereKey($districtId)->update(['poverty_rate' => $row['poverty_rate']]),
            'rainfall' => RainfallRecord::updateOrCreate($key, ['rainfall_mm' => $row['rainfall_mm']]),
            'reports' => DroughtReport::updateOrCreate($key, [
                'households_surveyed' => $row['households_surveyed'],
                'households_reporting_drought' => $row['households_reporting_drought'],
            ]),
        };
    }
}
