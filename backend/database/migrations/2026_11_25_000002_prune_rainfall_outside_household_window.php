<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Keeps only the satellite rainfall inside the household survey window (config raincheck.comparison_start
 * to comparison_end) and removes every other month, so the dashboard shows only data that can be compared
 * with what households reported.
 *
 * "Normal" rainfall is the median of the same month in the other years. Before the other years are removed,
 * that normal is stored on each month that stays, so dry months are judged exactly as before.
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

        DB::table('rainfall_records')
            ->whereRaw('(year * 100 + month) < ? OR (year * 100 + month) > ?', [$start, $end])
            ->delete();
    }

    public function down(): void
    {
        // The removed rainfall is not stored anywhere else. Re-import the full data/rainfall.csv from git history to restore it.
    }
};
