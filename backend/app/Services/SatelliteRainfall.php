<?php

namespace App\Services;

use App\Models\District;
use App\Models\RainfallRecord;
use App\Models\SatelliteRainfallRecord;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Gets official satellite rainfall for the months a household survey asked about.
 *
 * The rainfall already stored in the project is never changed. When it covers a survey period it is used as
 * before; otherwise all 12 months come from the official maps, so one comparison never mixes the two.
 */
class SatelliteRainfall
{
    private const FILE_NAME = 'chirps-v3.0.%04d.%02d.tif';

    /**
     * Like CFSVA 2024 (asked in April 2024 about the 12 months before), a survey is compared with
     * the April to March year that ends in the survey year.
     *
     * @return array{start: string, end: string}
     */
    public function windowFor(int $surveyYear): array
    {
        return ['start' => sprintf('%04d-04', $surveyYear - 1), 'end' => sprintf('%04d-03', $surveyYear)];
    }

    /**
     * @param  array{start: string, end: string}  $window
     * @return array<int, array{0: int, 1: int}> [year, month] pairs
     */
    public function monthsIn(array $window): array
    {
        $month = Carbon::createFromFormat('!Y-m', $window['start']);
        $months = [];

        while ($month->format('Y-m') <= $window['end']) {
            $months[] = [$month->year, $month->month];
            $month->addMonth();
        }

        return $months;
    }

    /** Whether the project's own rainfall has every district for every month of the period. */
    public function storedDataCovers(array $window): bool
    {
        $districts = District::count();

        return $districts > 0
            && RainfallRecord::query()
                ->whereRaw('(year * 100 + month) between ? and ?', $this->bounds($window))
                ->count() >= $districts * count($this->monthsIn($window));
    }

    /** @return array<int, string> months (YYYY-MM) still to be downloaded for the period */
    public function missingMonths(array $window): array
    {
        $districts = District::count();
        $stored = SatelliteRainfallRecord::query()
            ->whereRaw('(year * 100 + month) between ? and ?', $this->bounds($window))
            ->get(['year', 'month'])
            ->countBy(fn (SatelliteRainfallRecord $r) => sprintf('%04d-%02d', $r->year, $r->month));

        return collect($this->monthsIn($window))
            ->map(fn (array $m) => sprintf('%04d-%02d', $m[0], $m[1]))
            ->filter(fn (string $key) => ($stored[$key] ?? 0) < $districts)
            ->values()
            ->all();
    }

    /**
     * Downloads one month, averages it per district and saves it.
     *
     * @return bool false when the month has not been published yet
     */
    public function fetchMonth(int $year, int $month): bool
    {
        // A month that has not ended cannot have a final map.
        if (Carbon::create($year, $month, 1)->endOfMonth()->isFuture()) {
            return false;
        }

        $normals = $this->normals();

        // Two people opening the same survey must not download the same month at the same time.
        return Cache::lock(sprintf('chirps-%04d-%02d', $year, $month), 180)->block(150, function () use ($year, $month, $normals) {
            if (SatelliteRainfallRecord::where('year', $year)->where('month', $month)->count() >= District::count()) {
                return true;
            }

            $means = $this->districtMeans($year, $month);

            if ($means === null) {
                return false;
            }

            foreach ($means as $districtId => $rainfall) {
                SatelliteRainfallRecord::updateOrCreate(
                    ['district_id' => $districtId, 'year' => $year, 'month' => $month],
                    [
                        'rainfall_mm' => $rainfall,
                        'normal_mm' => $normals[$districtId][$month]
                            ?? throw new RuntimeException('Normal rainfall is missing for a district.'),
                    ],
                );
            }

            return true;
        });
    }

    /**
     * Average rainfall in every district for one month, from the official map.
     *
     * @return array<int, float>|null rainfall in mm by district id, or null when the map is not published
     */
    public function districtMeans(int $year, int $month): ?array
    {
        $grid = $this->map(rtrim(config('raincheck.chirps_url'), '/').'/'.sprintf(self::FILE_NAME, $year, $month));

        if ($grid === null) {
            return null;
        }

        $outlines = $this->boundaries();
        $grid->preload($outlines);
        $means = [];

        foreach ($outlines as $districtId => $geometry) {
            $mean = $grid->meanInside($geometry);

            if ($mean === null) {
                throw new RuntimeException('The satellite map has no value for a district.');
            }

            $means[$districtId] = round($mean, 2);
        }

        return $means;
    }

    /**
     * Opens a map, downloading only the parts of the file that are read (each map covers all of Africa).
     *
     * @return ChirpsGrid|null null when the map is not published
     */
    private function map(string $url): ?ChirpsGrid
    {
        $whole = null;
        $missing = false;

        $read = function (int $offset, int $length) use ($url, &$whole, &$missing): string {
            if ($whole === null) {
                $response = $this->download($url, $offset, $length);

                if ($response->status() === 206) {
                    return $response->body();
                }

                $missing = $response->status() === 404;

                if (! $response->successful()) {
                    throw new RuntimeException('The satellite server answered with status '.$response->status().'.');
                }

                // The server sent the whole file instead of the part that was asked for.
                $whole = $response->body();
            }

            return substr($whole, $offset, $length);
        };

        try {
            return new ChirpsGrid($read);
        } catch (RuntimeException $e) {
            if ($missing) {
                return null;
            }

            throw $e;
        }
    }

    private function download(string $url, int $offset, int $length): Response
    {
        $caBundle = config('raincheck.ca_bundle');

        return Http::withOptions(['verify' => $caBundle && is_file($caBundle) ? $caBundle : true])
            ->withHeaders(['Range' => 'bytes='.$offset.'-'.($offset + $length - 1)])
            ->timeout(90)
            ->retry(3, 2000, fn ($e) => ! isset($e->response) || $e->response->serverError(), throw: false)
            ->get($url);
    }

    /** @return array{0: int, 1: int} */
    private function bounds(array $window): array
    {
        return [(int) str_replace('-', '', $window['start']), (int) str_replace('-', '', $window['end'])];
    }

    /** @return array<int, array> district outline by district id */
    private function boundaries(): array
    {
        $features = json_decode((string) @file_get_contents(config('raincheck.boundaries_file')), true)['features'] ?? null;

        if (! $features) {
            throw new RuntimeException('The district boundaries file could not be read.');
        }

        $ids = District::pluck('id', 'name');
        $outlines = [];

        foreach ($features as $feature) {
            $id = $ids[$feature['properties']['shapeName']] ?? null;

            if ($id !== null) {
                $outlines[$id] = $feature['geometry'];
            }
        }

        if (count($outlines) < $ids->count()) {
            throw new RuntimeException('Some districts have no outline in the boundaries file.');
        }

        return $outlines;
    }

    /** @return array<int, array<int, float>> normal rainfall by district id and calendar month */
    private function normals(): array
    {
        $handle = @fopen(config('raincheck.satellite_normals_file'), 'r');

        if (! $handle) {
            throw new RuntimeException('The normal rainfall file could not be read.');
        }

        $ids = District::pluck('id', 'name');
        $header = fgetcsv($handle, null, ',', '"', '');
        $normals = [];

        while (($line = fgetcsv($handle, null, ',', '"', '')) !== false) {
            $row = array_combine($header, $line);

            if (isset($ids[$row['district']])) {
                $normals[$ids[$row['district']]][(int) $row['month']] = (float) $row['normal_mm'];
            }
        }

        fclose($handle);

        return $normals;
    }
}
