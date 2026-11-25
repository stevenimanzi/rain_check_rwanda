<?php

namespace App\Services;

/**
 * Turns "it happened k times in n years" into a chance that does not pretend to be more certain than it is.
 */
class ChanceEstimator
{
    /**
     * Share of years that matched, with the 95% Wilson interval around it.
     *
     * With only 10 or 11 years of data the interval is wide on purpose: "9 of 10" is about 90%, but the true chance
     * could plausibly be anywhere from about 60% to 98%. The Wilson interval stays sensible at 0 and at n, unlike
     * the textbook interval.
     *
     * @return array{count: int, years: int, pct: float|null, low: float|null, high: float|null}
     */
    public static function share(int $count, int $years): array
    {
        if ($years <= 0) {
            return ['count' => $count, 'years' => 0, 'pct' => null, 'low' => null, 'high' => null];
        }

        $z = 1.96;
        $p = $count / $years;
        $denominator = 1 + $z ** 2 / $years;
        $centre = ($p + $z ** 2 / (2 * $years)) / $denominator;
        $margin = $z * sqrt($p * (1 - $p) / $years + $z ** 2 / (4 * $years ** 2)) / $denominator;

        return [
            'count' => $count,
            'years' => $years,
            'pct' => round($p * 100, 1),
            'low' => round(max(0, $centre - $margin) * 100, 1),
            'high' => round(min(1, $centre + $margin) * 100, 1),
        ];
    }
}
