<?php

namespace App\Http\Controllers;

use App\Services\DistrictAnalysis;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __construct(private DistrictAnalysis $analysis)
    {
    }

    /**
     * One row per district: poverty, households reporting drought, satellite drought history and basis risk.
     */
    public function districts(): StreamedResponse
    {
        $header = [
            'district', 'province', 'poverty_rate_pct', 'households_reporting_drought_pct',
            'avg_dry_months_per_year', 'dry_share_pct', 'satellite_dry_months_in_window',
            'satellite_rank_pct', 'household_rank_pct', 'basis_risk_points', 'basis_risk_level', 'direction',
        ];

        $rows = $this->analysis->all()->map(fn (array $d) => [
            $d['name'],
            $d['province'],
            $d['poverty_rate'],
            $d['household_drought_pct'],
            $d['summary']['avg_dry_months_per_year'],
            $d['history']['dry_share_pct'],
            $d['summary']['satellite_drought_months'],
            $d['summary']['satellite_rank_pct'] ?? null,
            $d['summary']['household_rank_pct'] ?? null,
            $d['summary']['basis_risk_pct'],
            $d['summary']['risk_level'],
            $d['summary']['direction'],
        ]);

        return $this->csv('raincheck_districts.csv', $header, $rows);
    }

    /**
     * One row per district and month: satellite rainfall against normal.
     */
    public function rainfall(): StreamedResponse
    {
        $header = ['district', 'year', 'month', 'rainfall_mm', 'normal_mm', 'deficit_pct', 'judged', 'dry_month'];

        $rows = $this->analysis->all()->flatMap(
            fn (array $d) => $d['rainfall']->map(fn (array $m) => [
                $d['name'],
                $m['year'],
                $m['month'],
                $m['rainfall_mm'],
                $m['normal_mm'],
                $m['rainfall_deficit_pct'],
                $m['judged'] ? 'yes' : 'no',
                $m['satellite_drought'] ? 'yes' : 'no',
            ])
        );

        return $this->csv('raincheck_monthly_rainfall.csv', $header, $rows);
    }

    private function csv(string $filename, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $header);
            foreach ($rows as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
