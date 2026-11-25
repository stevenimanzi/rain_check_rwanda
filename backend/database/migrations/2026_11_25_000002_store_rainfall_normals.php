<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Stores the matched-period monthly normals before they are served by the dashboard.
 * Historical rainfall rows remain available as a baseline for other survey periods.
 */
return new class extends Migration
{
    public function up(): void
    {
        $start = (int) str_replace('-', '', config('raincheck.comparison_start'));
        $end = (int) str_replace('-', '', config('raincheck.comparison_end'));

        $all = DB::table('rainfall_records')->get(['id', 'district_id', 'year', 'month', 'rainfall_mm', 'normal_mm']);

        foreach ($all->groupBy(fn ($r) => $r->district_id.'-'.$r->month) as $records) {
            foreach ($records as $record) {
                $key = $record->year * 100 + $record->month;

                if ($key < $start || $key > $end || $record->normal_mm !== null) {
                    continue;
                }

                $others = $records->where('year', '!=', $record->year)->pluck('rainfall_mm')->map(fn ($mm) => (float) $mm)->sort()->values();

                if ($others->count() < 2) {
                    continue;
                }

                $middle = intdiv($others->count(), 2);
                $median = $others->count() % 2 ? $others[$middle] : ($others[$middle - 1] + $others[$middle]) / 2;

                DB::table('rainfall_records')->where('id', $record->id)->update(['normal_mm' => round($median, 2)]);
            }
        }
    }

    public function down(): void
    {
        // The stored normal values can be recalculated from the retained rainfall history.
    }
};
