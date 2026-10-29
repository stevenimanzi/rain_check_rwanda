<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Services\DroughtMatchService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __construct(private DroughtMatchService $matcher)
    {
    }

    /**
     * One row per district: poverty, long-term drought record and basis risk.
     */
    public function districts(): StreamedResponse
    {
        $header = [
            'district', 'province', 'poverty_rate_pct', 'avg_dry_months_per_year', 'dry_share_pct',
            'dry_months_in_survey_period', 'months_compared_with_households', 'basis_risk_pct', 'basis_risk_level',
        ];

        $rows = District::with(['rainfallRecords', 'droughtReports'])->orderBy('name')->get()->map(function (District $d) {
            $analysis = $this->matcher->analyse($d);

            return [
                $d->name,
                $d->province,
                $d->poverty_rate,
                $analysis['history']['avg_dry_months_per_year'],
                $analysis['history']['dry_share_pct'],
                $analysis['summary']['satellite_drought_months'],
                $analysis['summary']['months_tested'],
                $analysis['summary']['basis_risk_pct'],
                $analysis['summary']['risk_level'],
            ];
        });

        return $this->csv('raincheck_districts.csv', $header, $rows);
    }

    /**
     * One row per district and month: satellite rainfall against normal.
     */
    public function rainfall(): StreamedResponse
    {
        $header = ['district', 'year', 'month', 'rainfall_mm', 'normal_mm', 'deficit_pct', 'judged', 'dry_month'];

        $rows = District::with('rainfallRecords')->orderBy('name')->get()->flatMap(
            fn (District $d) => $this->matcher->rainfallSeries($d->rainfallRecords)->map(fn (array $m) => [
                $d->name,
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
