<?php

namespace App\Services;

use App\Models\District;
use App\Models\HouseholdSurveyImport;
use App\Models\RainfallRecord;
use Illuminate\Support\Collection;

/**
 * The data sources behind the assistant's answers: who published them, what they measure, how the
 * project uses them, and the rows stored in the database. Shown in the chat's "Data from" dialog.
 */
class AssistantSources
{
    public function __construct(private DistrictAnalysis $analysis)
    {
    }

    /**
     * @return array<string, array<string, mixed>> keyed by source id: rainfall, household, poverty, surveys
     */
    public function all(): array
    {
        $districts = $this->analysis->all();

        return array_filter([
            'rainfall' => $this->rainfall($districts),
            'household' => $this->household($districts),
            'poverty' => $this->poverty(),
            'crops' => $this->crops(),
            'surveys' => $this->surveys(),
        ]);
    }

    private function rainfall(Collection $districts): array
    {
        $deficit = config('raincheck.rainfall_deficit_threshold');
        $minimum = config('raincheck.minimum_normal_mm');
        $first = RainfallRecord::min('year');
        $last = RainfallRecord::max('year');

        return [
            'id' => 'rainfall',
            'title' => 'Satellite rainfall (CHIRPS v3)',
            'subtitle' => "Monthly rainfall for each district, {$first} to {$last}",
            'summary' => [
                ['label' => 'Monthly records', 'value' => number_format(RainfallRecord::count())],
                ['label' => 'Districts', 'value' => (string) $districts->count()],
                ['label' => 'Period', 'value' => "{$first} to {$last}"],
            ],
            'about' => [
                ['Published by', 'Climate Hazards Center, UC Santa Barbara (not NISR)'],
                ['Dataset', 'CHIRPS v3 monthly rainfall, Africa'],
                ['Link', 'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/africa/tifs/'],
                ['What it measures', 'Rainfall in millimetres from satellites and rain gauges, averaged over each district.'],
                ['How the project uses it', "Normal rainfall for a calendar month is the median of that month in the other years. A dry month is a month with {$deficit}% or more less rain than normal. Months that normally get under {$minimum} mm (June to August) are not judged."],
                ['Limits', 'It is an estimate on a 5 km grid, not a farm measurement. Dry spells shorter than a month are not visible, and a dry month is not the same as crop loss.'],
            ],
            'columns' => [
                ['key' => 'name', 'label' => 'District'],
                ['key' => 'province', 'label' => 'Province'],
                ['key' => 'dry', 'label' => 'Dry months, Apr 2023 to Mar 2024'],
                ['key' => 'avg', 'label' => 'Dry months each year'],
                ['key' => 'years', 'label' => 'Years covered'],
            ],
            'rows' => $districts->map(fn (array $d) => [
                'id' => $d['id'],
                'cells' => [
                    'name' => $d['name'],
                    'province' => $d['province'],
                    'dry' => $d['summary']['satellite_drought_months'],
                    'avg' => $d['summary']['avg_dry_months_per_year'],
                    'years' => $d['history']['years_covered'],
                ],
            ])->values()->all(),
        ];
    }

    private function household(Collection $districts): array
    {
        $values = $districts->pluck('household_drought_pct')->filter(fn ($v) => $v !== null);

        return [
            'id' => 'household',
            'title' => 'Household drought reports (CFSVA 2024)',
            'subtitle' => 'Share of households that reported drought, by district',
            'summary' => [
                ['label' => 'Districts with data', 'value' => (string) $values->count()],
                ['label' => 'Average', 'value' => $values->isNotEmpty() ? round($values->avg(), 1).'%' : '-'],
                ['label' => 'Highest', 'value' => $values->isNotEmpty() ? $values->max().'%' : '-'],
            ],
            'about' => [
                ['Published by', 'NISR and WFP, Rwanda Comprehensive Food Security and Vulnerability Analysis (CFSVA) 2024'],
                ['Link', 'https://statistics.gov.rw/sites/default/files/documents/2025-07/Rwanda%20CFSVA%202024.pdf'],
                ['What it measures', 'The share of households in each district that reported drought in the 12 months before the survey (April 2023 to March 2024).'],
                ['How the numbers were obtained', 'The report shows the district shares only as a bar chart (Figure 8.4). Each bar was measured from the chart, so values can be off by about 1 percentage point.'],
                ['How the project uses it', 'Each district gets a household score from 0 (lowest of the 30 districts) to 100 (highest). It is compared with the satellite score to find the mismatch risk.'],
                ['Limits', 'Answers are self-reported and cover one year only. The country average is an unweighted average of the 30 districts.'],
            ],
            'columns' => [
                ['key' => 'name', 'label' => 'District'],
                ['key' => 'province', 'label' => 'Province'],
                ['key' => 'household', 'label' => 'Households that reported drought'],
                ['key' => 'score', 'label' => 'Household score (0 to 100)'],
            ],
            'rows' => $districts->map(fn (array $d) => [
                'id' => $d['id'],
                'cells' => [
                    'name' => $d['name'],
                    'province' => $d['province'],
                    'household' => $d['household_drought_pct'] !== null ? $d['household_drought_pct'].'%' : '-',
                    'score' => $d['summary']['household_rank_pct'] ?? '-',
                ],
            ])->values()->all(),
        ];
    }

    private function poverty(): ?array
    {
        $districts = District::orderBy('name')->get();
        $rates = $districts->pluck('poverty_rate')->filter(fn ($v) => $v !== null);

        if ($rates->isEmpty()) {
            return null;
        }

        return [
            'id' => 'poverty',
            'title' => 'Poverty rate (EICV7 2024)',
            'subtitle' => 'Share of people living in poverty, by district',
            'summary' => [
                ['label' => 'Districts with data', 'value' => (string) $rates->count()],
                ['label' => 'Average', 'value' => round((float) $rates->avg(), 1).'%'],
                ['label' => 'Highest', 'value' => round((float) $rates->max(), 1).'%'],
            ],
            'about' => [
                ['Published by', 'National Institute of Statistics of Rwanda (NISR), Integrated Household Living Conditions Survey (EICV7), 2024'],
                ['What it measures', 'The poverty rate of each district.'],
                ['How the project uses it', 'It is stored for context next to the drought results. It is not part of the satellite score, the household score or the mismatch risk.'],
            ],
            'columns' => [
                ['key' => 'name', 'label' => 'District'],
                ['key' => 'province', 'label' => 'Province'],
                ['key' => 'poverty', 'label' => 'Poverty rate'],
            ],
            'rows' => $districts->map(fn (District $d) => [
                'id' => $d->id,
                'cells' => [
                    'name' => $d->name,
                    'province' => $d->province,
                    'poverty' => $d->poverty_rate !== null ? round((float) $d->poverty_rate, 1).'%' : '-',
                ],
            ])->values()->all(),
        ];
    }

    private function surveys(): ?array
    {
        $imports = HouseholdSurveyImport::with('observations.district:id,name,province')
            ->orderByDesc('survey_year')->orderByDesc('id')->get();

        if ($imports->isEmpty()) {
            return null;
        }

        $rows = $imports->flatMap(fn (HouseholdSurveyImport $import) => $import->observations
            ->sortBy(fn ($o) => $o->district->name)
            ->map(fn ($o) => [
                'id' => "{$import->id}-{$o->district_id}",
                'cells' => [
                    'survey' => $import->source_name,
                    'year' => $import->survey_year,
                    'name' => $o->district->name,
                    'household' => $o->household_drought_pct.'%',
                ],
            ]))->values()->all();

        return [
            'id' => 'surveys',
            'title' => 'Extra household surveys',
            'subtitle' => 'Surveys saved by an admin on the Overview page',
            'summary' => [
                ['label' => 'Surveys', 'value' => (string) $imports->count()],
                ['label' => 'Rows', 'value' => (string) count($rows)],
            ],
            'about' => [
                ['Published by', $imports->pluck('source_name')->unique()->implode(', ')],
                ['What it measures', 'The share of households reporting drought in each district, as entered in the uploaded file.'],
                ['Limits', 'Uploaded surveys carry the source name the uploader entered. They are not independently verified by NISR.'],
            ],
            'columns' => [
                ['key' => 'survey', 'label' => 'Survey'],
                ['key' => 'year', 'label' => 'Year'],
                ['key' => 'name', 'label' => 'District'],
                ['key' => 'household', 'label' => 'Households that reported drought'],
            ],
            'rows' => $rows,
        ];
    }

    /** The crop water needs behind the Predict Future page. */
    private function crops(): array
    {
        $crops = collect(app(CropSuitability::class)->crops());

        return [
            'id' => 'crops',
            'title' => 'Crop water needs',
            'subtitle' => 'What each crop needs from the rain, used to judge past seasons',
            'summary' => [
                ['label' => 'Crops', 'value' => (string) $crops->count()],
                ['label' => 'Judged on', 'value' => 'Rain only'],
            ],
            'about' => [
                ['Source', 'Rounded reference values in the spirit of the FAO crop water guidelines (FAO Irrigation and Drainage Papers 33 and 56). They are not measured in Rwanda and are not part of the satellite or household data.'],
                ['How the project uses them', 'Each past planting window is judged on three checks: the rain over the whole season, dry months while the crop is growing, and rain in the flowering month. The share of years that passed all checks is the chance shown on the Predict Future page.'],
                ['Limits', 'Sunshine, temperature, soil, variety, pests and altitude are not judged. An agronomist can change the values in config/crops.php.'],
            ],
            'columns' => [
                ['key' => 'crop', 'label' => 'Crop'],
                ['key' => 'cycle', 'label' => 'Months from planting to harvest'],
                ['key' => 'season', 'label' => 'Good season rain'],
                ['key' => 'monthly', 'label' => 'Least rain in a growing month'],
                ['key' => 'flowering', 'label' => 'Least rain at flowering'],
            ],
            'rows' => $crops->map(fn (array $crop) => [
                'id' => $crop['id'],
                'cells' => [
                    'crop' => $crop['name'],
                    'cycle' => $crop['cycle_months'],
                    'season' => $crop['good_mm'][0].' to '.$crop['good_mm'][1].' mm',
                    'monthly' => $crop['min_monthly_mm'].' mm',
                    'flowering' => $crop['flowering_min_mm'].' mm (month '.$crop['flowering_month'].')',
                ],
            ])->values()->all(),
        ];
    }
}
