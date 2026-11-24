<?php

namespace App\Console\Commands;

use App\Models\RainfallRecord;
use Illuminate\Console\Command;

class InstallData extends Command
{
    protected $signature = 'raincheck:install-data {--path= : folder that holds the CSV files}';

    protected $description = 'Load the districts and all data files, unless the data is already loaded';

    /** Import type and file name, in the order they are loaded. */
    private const FILES = [
        ['rainfall', 'rainfall.csv'],
        ['poverty', 'poverty_eicv7_2024.csv'],
        ['household-drought', 'household_drought_cfsva_2024.csv'],
    ];

    public function handle(): int
    {
        $this->callSilently('db:seed', ['--force' => true]);

        if (RainfallRecord::exists()) {
            $this->info('Data is already loaded.');

            return self::SUCCESS;
        }

        $folder = rtrim($this->option('path') ?: base_path('../data'), '/');

        foreach (self::FILES as [$type, $file]) {
            $status = $this->call('raincheck:import', ['type' => $type, 'file' => "{$folder}/{$file}"]);

            if ($status !== self::SUCCESS) {
                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }
}
