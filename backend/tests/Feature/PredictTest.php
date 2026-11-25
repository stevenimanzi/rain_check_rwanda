<?php

namespace Tests\Feature;

use App\Services\CropSuitability;
use App\Services\DistrictAnalysis;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PredictTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A district shaped like DistrictAnalysis::all() returns it: one season of rain (April 2023 to March 2024),
     * each month with its normal rain.
     *
     * @param  callable(int): float  $observed  rain that fell, by calendar month
     * @param  callable(int): float  $normal  normal rain, by calendar month
     */
    private function district(int $id, string $name, string $risk, callable $observed, callable $normal, string $direction = 'agrees'): array
    {
        $series = collect();

        foreach (range(0, 11) as $i) {
            $month = ($i + 3) % 12 + 1;
            $year = $month >= 4 ? 2023 : 2024;
            $mm = $observed($month);
            $norm = $normal($month);

            $series->push([
                'year' => $year,
                'month' => $month,
                'rainfall_mm' => $mm,
                'normal_mm' => $norm,
                'rainfall_deficit_pct' => round(($norm - $mm) / $norm * 100, 1),
                'judged' => true,
                'satellite_drought' => ($norm - $mm) / $norm >= 0.2,
            ]);
        }

        return [
            'id' => $id,
            'name' => $name,
            'province' => 'Test Province',
            'household_drought_pct' => $risk === 'no_data' ? null : 20.0,
            'rainfall' => $series,
            'history' => ['years_covered' => 1, 'by_calendar_month' => []],
            'summary' => ['risk_level' => $risk, 'direction' => $direction, 'basis_risk_pct' => $risk === 'high' ? 60.0 : 5.0],
        ];
    }

    private function fakeAnalysis(array $districts): void
    {
        $this->mock(DistrictAnalysis::class, fn ($mock) => $mock->shouldReceive('all')->andReturn(collect($districts)));
    }

    private function standardDistricts(): array
    {
        $wet = fn () => 120.0;
        $dry = fn () => 20.0;

        return [
            // Enough rain in a normal year and in the observed season.
            $this->district(1, 'Wetville', 'low', $wet, $wet),
            // Never enough rain.
            $this->district(2, 'Dryton', 'medium', $dry, $dry, 'satellite_understates'),
            // Fine on paper, but households and satellite disagree strongly: must not be used.
            $this->district(3, 'Trapland', 'high', $wet, $wet, 'satellite_understates'),
            // A normal year would be fine, but the observed season fell short.
            $this->district(4, 'Halfway', 'low', $dry, $wet),
            // Same rain as Wetville, but no household value to check it against.
            $this->district(5, 'Unchecked', 'no_data', $wet, $wet),
        ];
    }

    public function test_a_season_is_judged_on_total_rain_dry_months_and_flowering(): void
    {
        $maize = app(CropSuitability::class)->profile('maize');
        $judge = fn (array $monthly) => app(CropSuitability::class)->judge($monthly, $maize, 9);

        $this->assertSame('good', $judge([100, 120, 130, 110, 60])['verdict']);

        // One dry growing month is marginal, two are poor.
        $this->assertSame('marginal', $judge([100, 120, 130, 40, 80])['verdict']);
        $this->assertSame('poor', $judge([100, 20, 130, 40, 80])['verdict']);

        // Plenty of rain overall, but almost none in the flowering month (month 3).
        $flowering = $judge([150, 150, 20, 150, 150]);
        $this->assertSame('poor', $flowering['verdict']);
        $this->assertStringContainsString('flowering', implode(' ', $flowering['reasons']));

        // Far too little rain over the season.
        $this->assertSame('poor', $judge([40, 50, 60, 70, 20])['verdict']);

        // A ripening month with no rain is fine.
        $this->assertSame('good', $judge([130, 130, 130, 130, 0])['verdict']);
    }

    public function test_untrusted_districts_are_left_out_and_the_rest_are_ranked(): void
    {
        $this->fakeAnalysis($this->standardDistricts());

        $result = app(CropSuitability::class)->forCrop('maize');
        $ranked = collect($result['ranking']);

        $this->assertSame('April 2023 to March 2024', $result['period']['label']);
        $this->assertSame(['Trapland'], collect($result['excluded'])->pluck('name')->all());
        $this->assertStringContainsString('no prediction is made', $result['excluded'][0]['reason']);

        // Normal year, then observed season, then households, then trust.
        $this->assertSame(['Wetville', 'Unchecked', 'Halfway', 'Dryton'], $ranked->pluck('name')->all());
        $this->assertSame([1, 2, 3, 4], $ranked->pluck('rank')->all());

        $wetville = $ranked->firstWhere('name', 'Wetville');
        $this->assertSame('verified', $wetville['trust']);
        // One observed season is never high confidence.
        $this->assertSame('medium', $wetville['confidence']);
        $this->assertSame('good', $wetville['best']['typical']['verdict']);
        $this->assertSame(600.0, $wetville['best']['typical']['total_mm']);
        $this->assertSame(120, $wetville['best']['typical']['need_pct']);
        $this->assertSame('good', $wetville['best']['observed']['verdict']);

        $halfway = $ranked->firstWhere('name', 'Halfway');
        $this->assertSame('good', $halfway['best']['typical']['verdict']);
        // The rain that really fell in an October-planted season was poor, so a month without an observed season ranks above it.
        $this->assertSame('poor', collect($halfway['by_month'])->firstWhere('name', 'October')['observed']['verdict']);
        $this->assertNull($halfway['best']['observed']);

        $dryton = $ranked->firstWhere('name', 'Dryton');
        $this->assertSame('usable', $dryton['trust']);
        $this->assertSame('low', $dryton['confidence']);
        $this->assertSame('poor', $dryton['best']['typical']['verdict']);
        $this->assertStringContainsString('less than this says', $dryton['caveat']);

        $unchecked = $ranked->firstWhere('name', 'Unchecked');
        $this->assertSame('unverified', $unchecked['trust']);
        $this->assertSame('low', $unchecked['confidence']);
        $this->assertNotNull($unchecked['caveat']);
    }

    public function test_every_month_has_a_normal_year_but_only_some_have_an_observed_season(): void
    {
        $this->fakeAnalysis([$this->district(1, 'Wetville', 'low', fn () => 120.0, fn () => 120.0)]);

        $row = app(CropSuitability::class)->forCrop('maize')['ranking'][0];

        $this->assertCount(12, $row['by_month']);
        $this->assertNotContains(null, array_column($row['by_month'], 'typical'));

        $byName = collect($row['by_month'])->keyBy('name');

        // A season planted in October (to February) fits inside April 2023 to March 2024; one planted in February does not.
        $this->assertNotNull($byName['October']['observed']);
        $this->assertSame('Oct 2023 to Feb 2024', $byName['October']['observed']['label']);
        $this->assertNull($byName['February']['observed']);

        $this->assertContains($row['best']['month'], [9, 10, 2, 3]);
        $this->assertTrue($row['best']['usual']);
        // Planted in the best month, harvested four months later (maize has a five month cycle).
        $this->assertSame(($row['best']['month'] + 3) % 12 + 1, $row['best']['harvest_month']);
    }

    public function test_crop_names_are_found_in_english_french_and_kinyarwanda(): void
    {
        $suitability = app(CropSuitability::class);

        $this->assertSame(['maize'], $suitability->cropIdsIn('Where can I grow Maize?'));
        $this->assertSame(['beans'], $suitability->cropIdsIn('Ni he nahinga ibishyimbo?'));
        $this->assertSame(['potato'], $suitability->cropIdsIn('pomme de terre à Musanze'));
        $this->assertSame([], $suitability->cropIdsIn('Which district is driest?'));
    }

    private function ask(array $messages, ?array $districts = null): array
    {
        config(['services.google.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'answer']]]]],
        ])]);
        $this->fakeAnalysis($districts ?? $this->standardDistricts());

        $this->postJson('/api/predict', ['messages' => $messages])->assertOk()->assertJsonPath('reply', 'answer');

        $sent = null;
        Http::assertSent(function ($request) use (&$sent) {
            $sent = $request['systemInstruction']['parts'][0]['text'];

            return true;
        });

        return [$sent];
    }

    public function test_chat_prompt_carries_calculated_figures_and_the_honesty_rules(): void
    {
        [$prompt] = $this->ask([['role' => 'user', 'content' => 'Which district is best for maize?']]);

        $this->assertStringContainsString('1. Wetville', $prompt);
        $this->assertStringContainsString('normal year: 600 mm = 120% of need, good', $prompt);
        $this->assertMatchesRegularExpression('/observed (Sep|Oct) 2023 to (Jan|Feb) 2024: 600 mm = 120% of need, good/', $prompt);
        $this->assertStringContainsString('households reporting drought: 20%', $prompt);
        $this->assertStringContainsString('Only ONE observed season exists', $prompt);
        $this->assertStringContainsString('Never write "X% chance"', $prompt);
        $this->assertStringContainsString('NOT in the database: sunshine, temperature', $prompt);
        $this->assertStringContainsString('Left out, no prediction made:', $prompt);
        $this->assertStringContainsString('NOT TRUSTED, high mismatch risk', $prompt);
        // Maize only, until another crop is asked about.
        $this->assertStringNotContainsString('Beans ranking', $prompt);
        $this->assertStringContainsString('Other crops that can be ranked', $prompt);
        // Nothing from outside the household window is claimed.
        $this->assertStringNotContainsString('2014', $prompt);
    }

    public function test_chat_prompt_follows_the_crop_and_district_in_the_question(): void
    {
        [$prompt] = $this->ask([['role' => 'user', 'content' => 'And ibishyimbo in Halfway?']]);

        $this->assertStringContainsString('Beans ranking', $prompt);
        $this->assertStringContainsString('Beans in Halfway, by planting month', $prompt);
        $this->assertStringContainsString('normal year', $prompt);
        $this->assertStringNotContainsString('Maize ranking', $prompt);
    }

    public function test_an_excluded_district_gets_no_numbers(): void
    {
        [$prompt] = $this->ask([['role' => 'user', 'content' => 'Can I grow maize in Trapland?']]);

        $this->assertStringContainsString('Maize in Trapland: no prediction.', $prompt);
        $this->assertStringNotContainsString('Maize in Trapland, by planting month', $prompt);
    }

    public function test_chat_needs_the_key_and_a_user_message_last(): void
    {
        config(['services.google.key' => null]);
        $this->postJson('/api/predict', ['messages' => [['role' => 'user', 'content' => 'hi']]])->assertStatus(503);

        config(['services.google.key' => 'test-key']);
        $this->postJson('/api/predict', ['messages' => [['role' => 'assistant', 'content' => 'hi']]])->assertStatus(422);
    }

    public function test_crop_water_needs_are_available_as_a_clickable_source(): void
    {
        $this->getJson('/api/assistant/sources')->assertOk()
            ->assertJsonPath('data.crops.title', 'Crop water needs')
            ->assertJsonPath('data.crops.rows.0.cells.crop', 'Maize');
    }
}
