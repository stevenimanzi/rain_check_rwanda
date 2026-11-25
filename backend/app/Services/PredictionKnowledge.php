<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * The facts the Predict Future assistant answers from. Every percentage is calculated here, in code, from the
 * database: the AI only explains them and is never asked to work them out.
 */
class PredictionKnowledge
{
    /** Districts mentioned in the chat get their month-by-month detail, up to this many. */
    private const MAX_DETAILED_DISTRICTS = 3;

    public function __construct(private DistrictAnalysis $analysis, private CropSuitability $crops)
    {
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function build(array $messages): string
    {
        $districts = $this->analysis->all();
        $text = collect($messages)->where('role', 'user')->pluck('content')->implode(' ');
        $cropIds = $this->crops->cropIdsIn($text) ?: ['maize'];
        $mentioned = $this->mentioned($districts, $text);

        // When a district is named without a crop, every crop is shown for that district.
        $detailCrops = $this->crops->cropIdsIn($text) ?: ($mentioned->isNotEmpty() ? array_keys($this->crops->crops()) : ['maize']);

        $sections = [$this->scope($districts)];

        foreach ($cropIds as $cropId) {
            $sections[] = $this->cropRanking($cropId, $districts);
        }

        foreach ($mentioned as $district) {
            foreach ($detailCrops as $cropId) {
                $sections[] = $this->districtDetail($cropId, $district, $districts);
            }
        }

        $sections[] = $this->otherCrops($cropIds);
        $sections[] = $this->climate($districts);

        return implode("\n\n", array_filter($sections));
    }

    private function scope(Collection $districts): string
    {
        $trust = $districts->countBy(fn (array $d) => $this->crops->trust($d));
        $period = $this->crops->period($districts);
        $first = $period['first_year'];
        $last = $period['last_year'];

        return "What the predictions are made from:\n"
            ."- Satellite rainfall (CHIRPS v3), monthly, {$first} to {$last}, for {$districts->count()} districts. Nothing before {$first} is in the database.\n"
            ."- A \"chance\" below is how often something happened in those past years. It is not a weather forecast for next year.\n"
            ."- Trust rule: the satellite is used only where households agree with it. Mismatch risk low = verified, medium = usable (flagged), high = excluded (no prediction), no household value = unverified (low confidence).\n"
            .'- Districts: '.($trust['verified'] ?? 0).' verified, '.($trust['usable'] ?? 0).' usable, '.($trust['excluded'] ?? 0).' excluded, '.($trust['unverified'] ?? 0).' unverified.'."\n"
            ."- NOT in the database: sunshine, temperature, soil, pests, prices, crop yields, and any weather forecast. Say so plainly if asked.";
    }

    private function cropRanking(string $cropId, Collection $districts): string
    {
        $result = $this->crops->forCrop($cropId, $districts);
        $crop = $result['crop'];

        $lines = [
            "{$crop['name']} - what it needs (approximate agronomic reference, not from the project data):",
            '- Rain over the whole season ('.$crop['cycle_months'].' months from planting): '.$crop['good_mm'][0].' to '.$crop['good_mm'][1].' mm is good; under '.$crop['fail_mm'][0].' mm or over '.$crop['fail_mm'][1].' mm is poor.',
            '- At least '.$crop['min_monthly_mm'].' mm in every growing month; at least '.$crop['flowering_min_mm'].' mm in month '.$crop['flowering_month'].' (flowering). '.$crop['note'],
            '- Usual planting months: '.collect($crop['usual_planting_months'])->map(fn ($m) => CropSuitability::monthName($m))->implode(', ').'. The ranking compares only these months.',
            '- A "good season" means all those needs were met; "marginal" means one need was missed a little; "poor" means a serious miss.',
            '',
            "{$crop['name']} ranking (best first). Each line: best planting month; good seasons out of years checked, with the 95% plausible range; marginal and poor seasons; trust; confidence:",
        ];

        foreach ($result['ranking'] as $row) {
            $best = $row['best'];
            $good = $best['good'];
            $lines[] = sprintf(
                '%d. %s (%s) | plant in %s, harvest %s | good in %d of %d years = %s%% (range %s%% to %s%%) | marginal %d, poor %d | average season rain %s mm | trust: %s (mismatch %s) | confidence: %s%s',
                $row['rank'], $row['name'], $row['province'], $best['name'], $best['harvest_name'],
                $good['count'], $good['years'], $good['pct'], $good['low'], $good['high'],
                $best['marginal'], $best['poor'], $best['average_season_mm'],
                $row['trust'], $row['risk_level'], $row['confidence'],
                $row['caveat'] ? ' | caveat: '.$row['caveat'] : '',
            );
        }

        if ($result['excluded']) {
            $lines[] = '';
            $lines[] = 'Left out, no prediction made:';

            foreach ($result['excluded'] as $row) {
                $lines[] = "- {$row['name']} ({$row['province']}): {$row['reason']}"
                    .($row['household_drought_pct'] !== null ? " Households reporting drought: {$row['household_drought_pct']}%." : '');
            }
        }

        return implode("\n", $lines);
    }

    /** Every planting month for one district and crop, and the years behind the best one. */
    private function districtDetail(string $cropId, array $district, Collection $districts): ?string
    {
        $row = $this->crops->forDistrict($cropId, $district['name'], $districts);

        if ($row === null) {
            return null;
        }

        $crop = $this->crops->profile($cropId)['name'];

        if (isset($row['why'])) {
            return "{$crop} in {$row['name']}: no prediction. {$row['reason']}";
        }

        $lines = ["{$crop} in {$row['name']}, by planting month (good / marginal / poor years, average season rain):"];

        foreach ($row['by_month'] as $month) {
            $lines[] = sprintf(
                '- %s%s: good %d of %d (%s%%), marginal %d, poor %d, average %s mm',
                $month['name'], $month['usual'] ? ' (usual)' : '',
                $month['good']['count'], $month['years'], $month['good']['pct'] ?? 'n/a',
                $month['marginal'], $month['poor'], $month['average_season_mm'] ?? 'n/a',
            );
        }

        $lines[] = "Year by year for the best month ({$row['best']['name']}):";

        foreach ($row['best']['seasons'] as $season) {
            $lines[] = "- {$season['label']}: {$season['total_mm']} mm, {$season['verdict']}".($season['reasons'] ? ' ('.implode(' ', $season['reasons']).')' : '');
        }

        return implode("\n", $lines);
    }

    private function otherCrops(array $shown): ?string
    {
        $others = collect($this->crops->crops())->except($shown)->pluck('name');

        return $others->isEmpty() ? null : 'Other crops that can be ranked the same way (the user only has to ask): '.$others->implode(', ').'.';
    }

    /**
     * Typical rain and how often a month was dry, for any "what will the rain be like" question that is not about a crop.
     */
    private function climate(Collection $districts): string
    {
        $lines = [
            'Rain by calendar month for each district: average mm over the years (lowest to highest year in brackets), then the share of years that month was dry (20% or more below normal; "-" means the month is normally too dry to judge). Use these to answer "how likely is a dry or wet month" questions, and give the number of years.',
        ];

        foreach ($districts as $district) {
            $byMonth = collect($district['rainfall'])->groupBy('month');
            $dry = collect($district['history']['by_calendar_month'])->keyBy('month');
            $years = $district['history']['years_covered'];
            $parts = [];

            foreach (range(1, 12) as $month) {
                $values = $byMonth->get($month, collect())->pluck('rainfall_mm');

                if ($values->isEmpty()) {
                    continue;
                }

                $share = $dry[$month]['dry_pct'] ?? null;
                $parts[] = substr(CropSuitability::monthName($month), 0, 3).' '.round($values->avg()).' ('.round($values->min()).'-'.round($values->max()).') dry '.($share === null ? '-' : round($share).'%');
            }

            $trust = $this->crops->trust($district);
            $label = $trust === 'excluded' ? 'NOT TRUSTED, high mismatch risk' : $trust;
            $lines[] = "{$district['name']} [{$label}, {$years} years]: ".implode('; ', $parts);
        }

        return implode("\n", $lines);
    }

    /** @return Collection<int, array> districts named in the text */
    private function mentioned(Collection $districts, string $text): Collection
    {
        $text = mb_strtolower($text);

        return $districts
            ->filter(fn (array $d) => preg_match('/(?<![\p{L}])'.preg_quote(mb_strtolower($d['name']), '/').'(?![\p{L}])/u', $text) === 1)
            ->take(self::MAX_DETAILED_DISTRICTS)
            ->values();
    }
}
