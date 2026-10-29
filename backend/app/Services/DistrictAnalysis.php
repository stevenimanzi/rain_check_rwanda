<?php

namespace App\Services;

use App\Models\District;
use Illuminate\Support\Collection;

/**
 * Builds the full picture for every district: satellite drought history next to what households reported.
 */
class DistrictAnalysis
{
    public function __construct(private DroughtMatchService $satellite)
    {
    }

    public function all(): Collection
    {
        $rows = District::with('rainfallRecords')->orderBy('name')->get()->map(function (District $district) {
            $series = $this->satellite->rainfallSeries($district->rainfallRecords);
            $history = $this->satellite->history($series);

            return [
                'id' => $district->id,
                'name' => $district->name,
                'province' => $district->province,
                'poverty_rate' => $this->number($district->poverty_rate),
                'household_drought_pct' => $this->number($district->household_drought_pct),
                'rainfall' => $series,
                'history' => $history,
                'summary' => [
                    'avg_dry_months_per_year' => $history['avg_dry_months_per_year'],
                    'satellite_drought_months' => $this->satellite->dryMonthsInWindow($series),
                ],
            ];
        });

        return $this->addBasisRisk($rows);
    }

    /**
     * Rank correlation between the satellite ranking and the household ranking across districts:
     * 1 means they rank districts identically, 0 means no relationship.
     */
    public function rankCorrelation(Collection $districts): ?float
    {
        $compared = $districts->filter(fn (array $d) => isset($d['summary']['satellite_rank_pct']));

        if ($compared->count() < 3) {
            return null;
        }

        $a = $compared->map(fn (array $d) => $d['summary']['satellite_rank_pct'])->values();
        $b = $compared->map(fn (array $d) => $d['summary']['household_rank_pct'])->values();

        $meanA = $a->avg();
        $meanB = $b->avg();
        $covariance = $a->map(fn ($x, $i) => ($x - $meanA) * ($b[$i] - $meanB))->sum();
        $spread = sqrt($a->map(fn ($x) => ($x - $meanA) ** 2)->sum() * $b->map(fn ($y) => ($y - $meanB) ** 2)->sum());

        return $spread > 0 ? round($covariance / $spread, 2) : null;
    }

    /**
     * Basis risk: how far apart a district's satellite rank and household rank are, in percentile points.
     * A positive gap means households suffered more drought than the satellite suggests.
     */
    private function addBasisRisk(Collection $districts): Collection
    {
        $compared = $districts->filter(fn (array $d) => $d['household_drought_pct'] !== null);
        $satelliteValues = $compared->map(fn (array $d) => $d['summary']['satellite_drought_months'])->values();
        $householdValues = $compared->map(fn (array $d) => $d['household_drought_pct'])->values();

        return $districts->map(function (array $district) use ($satelliteValues, $householdValues) {
            if ($district['household_drought_pct'] === null) {
                $district['summary'] += ['basis_risk_pct' => null, 'risk_level' => 'no_data', 'direction' => null];

                return $district;
            }

            $satelliteRank = $this->percentileRank($district['summary']['satellite_drought_months'], $satelliteValues);
            $householdRank = $this->percentileRank($district['household_drought_pct'], $householdValues);
            $gap = round($householdRank - $satelliteRank, 1);

            $district['summary'] += [
                'satellite_rank_pct' => $satelliteRank,
                'household_rank_pct' => $householdRank,
                'rank_gap' => $gap,
                'basis_risk_pct' => abs($gap),
                'risk_level' => $this->riskLevel(abs($gap)),
                'direction' => $this->direction($gap),
            ];

            return $district;
        })->values();
    }

    /**
     * Where a value sits among all values, from 0 (lowest) to 100 (highest); ties share the middle.
     */
    private function percentileRank(float $value, Collection $all): float
    {
        $below = $all->filter(fn ($v) => $v < $value)->count();
        $equal = $all->filter(fn ($v) => $v == $value)->count();

        return round(($below + ($equal - 1) / 2) / max($all->count() - 1, 1) * 100, 1);
    }

    private function riskLevel(float $gap): string
    {
        return match (true) {
            $gap >= config('raincheck.basis_risk_high') => 'high',
            $gap >= config('raincheck.basis_risk_medium') => 'medium',
            default => 'low',
        };
    }

    private function direction(float $gap): string
    {
        return match (true) {
            abs($gap) < config('raincheck.basis_risk_medium') => 'agrees',
            $gap > 0 => 'satellite_understates',
            default => 'satellite_overstates',
        };
    }

    private function number(mixed $value): ?float
    {
        return $value === null ? null : (float) $value;
    }
}
