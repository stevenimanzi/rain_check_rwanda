<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * The facts the Predict Future assistant answers from. Every figure is calculated here, in code, from the
 * database: the AI only explains them and is never asked to work them out.
 */
class PredictionKnowledge
{
    /** Districts mentioned in the chat get their month-by-month detail, up to this many. */
    private const MAX_DETAILED_DISTRICTS = 3;

    public function __construct(private DistrictAnalysis $analysis, private CropSuitability $crops) {}

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
        $period = $this->crops->period($districts)['label'];

        return "What the predictions are made from:\n"
            ."- Household drought reports (CFSVA 2024) are the main data: the share of households in each district that reported drought.\n"
            ."- Satellite rainfall (CHIRPS v3) is kept only for the same months households were asked about: {$period}, for {$districts->count()} districts. Nothing outside those months is in the database.\n"
            ."- Each month also has its NORMAL rain: the typical amount for that calendar month, worked out from earlier years before they were removed.\n"
            ."- A \"normal year\" below uses the normal rain of every month. The \"observed season\" uses the rain that really fell in {$period}, and exists only when the crop's whole growing time fits inside those months.\n"
            ."- Only ONE observed season exists, so no probability of success can be calculated. The percentages below are measurements, not chances.\n"
            ."- Trust rule: the satellite is used only where households agree with it. Mismatch risk low = verified, medium = usable (flagged), high = excluded (no prediction), no household value = unverified (low confidence).\n"
            .'- Districts: '.($trust['verified'] ?? 0).' verified, '.($trust['usable'] ?? 0).' usable, '.($trust['excluded'] ?? 0).' excluded, '.($trust['unverified'] ?? 0).' unverified.'."\n"
            .'- NOT in the database: sunshine, temperature, soil, pests, prices, crop yields, other years of rain, and any weather forecast. Say so plainly if asked.';
    }

    private function cropRanking(string $cropId, Collection $districts): string
    {
        $result = $this->crops->forCrop($cropId, $districts);
        $crop = $result['crop'];
        $period = $result['period']['label'];

        $lines = [
            "{$crop['name']} - what it needs (approximate agronomic reference, not from the project data):",
            '- Rain over the whole season ('.$crop['cycle_months'].' months from planting): '.$crop['good_mm'][0].' to '.$crop['good_mm'][1].' mm is good; under '.$crop['fail_mm'][0].' mm or over '.$crop['fail_mm'][1].' mm is poor. "% of need" is the season rain divided by '.$crop['good_mm'][0].' mm.',
            '- At least '.$crop['min_monthly_mm'].' mm in every growing month; at least '.$crop['flowering_min_mm'].' mm in month '.$crop['flowering_month'].' (flowering). '.$crop['note'],
            '- Usual planting months: '.collect($crop['usual_planting_months'])->map(fn ($m) => CropSuitability::monthName($m))->implode(', ').'. The ranking compares only these months.',
            '- "good" means all those needs were met; "marginal" means one need was missed a little; "poor" means a serious miss.',
            '',
            "{$crop['name']} ranking (best first: normal year, then observed season, then fewer households reporting drought). Each line: best planting month; normal year; observed season {$period}; households reporting drought; trust; confidence:",
        ];

        foreach ($result['ranking'] as $row) {
            $best = $row['best'];
            $lines[] = sprintf(
                '%d. %s (%s); plant in %s, harvest %s; normal year: %s mm = %d%% of need, %s; %s; households reporting drought: %s; trust: %s (mismatch %s); confidence: %s%s',
                $row['rank'], $row['name'], $row['province'], $best['name'], $best['harvest_name'],
                $best['typical']['total_mm'], $best['typical']['need_pct'], $best['typical']['verdict'],
                $this->observedText($best['observed']),
                $row['household_drought_pct'] !== null ? $row['household_drought_pct'].'%' : 'no value',
                $row['trust'], $row['risk_level'], $row['confidence'],
                $row['caveat'] ? '; caveat: '.$row['caveat'] : '',
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

    /** Every planting month for one district and crop. */
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

        $lines = [
            "{$crop} in {$row['name']}, by planting month"
            .($row['household_drought_pct'] !== null ? " (households reporting drought: {$row['household_drought_pct']}%)" : '').':',
        ];

        foreach ($row['by_month'] as $month) {
            if ($month['typical'] === null) {
                continue;
            }

            $lines[] = sprintf(
                '- %s%s: normal year %s mm = %d%% of need, %s%s; %s',
                $month['name'], $month['usual'] ? ' (usual)' : '',
                $month['typical']['total_mm'], $month['typical']['need_pct'], $month['typical']['verdict'],
                $month['typical']['reasons'] ? ' ('.implode(' ', $month['typical']['reasons']).')' : '',
                $this->observedText($month['observed']),
            );
        }

        return implode("\n", $lines);
    }

    private function observedText(?array $observed): string
    {
        if ($observed === null) {
            return 'observed season: not covered (the growing time does not fit inside the observed months)';
        }

        return "observed {$observed['label']}: {$observed['total_mm']} mm = {$observed['need_pct']}% of need, {$observed['verdict']}"
            .($observed['reasons'] ? ' ('.implode(' ', $observed['reasons']).')' : '');
    }

    private function otherCrops(array $shown): ?string
    {
        $others = collect($this->crops->crops())->except($shown)->pluck('name');

        return $others->isEmpty() ? null : 'Other crops that can be ranked the same way (the user only has to ask): '.$others->implode(', ').'.';
    }

    /**
     * Normal and observed rain for each calendar month, for questions that are not about a crop.
     */
    private function climate(Collection $districts): string
    {
        $period = $this->crops->period($districts)['label'];
        $lines = [
            "Rain by calendar month for each district: normal mm (the typical amount), then the mm that really fell in {$period} and how far it was from normal (negative = drier than normal; DRY = 20% or more below normal; \"-\" = the month is normally too dry to judge). Use these for \"how wet or dry is a month\" questions. There is only this one observed year, so do not give a likelihood.",
        ];

        foreach ($districts as $district) {
            $parts = [];

            foreach (collect($district['rainfall'])->sortBy(fn ($m) => $m['year'] * 100 + $m['month']) as $month) {
                $flag = ! $month['judged'] ? '-' : ($month['satellite_drought'] ? 'DRY' : 'ok');
                $parts[] = substr(CropSuitability::monthName($month['month']), 0, 3).' normal '.round($month['normal_mm'])
                    .', observed '.round($month['rainfall_mm']).' ('.sprintf('%+d', -round($month['rainfall_deficit_pct'])).'%) '.$flag;
            }

            $trust = $this->crops->trust($district);
            $label = $trust === 'excluded' ? 'NOT TRUSTED, high mismatch risk' : $trust;
            $lines[] = "{$district['name']} [{$label}]: ".implode('; ', $parts);
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
