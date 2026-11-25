<?php

namespace Tests\Feature;

use App\Services\ChanceEstimator;
use App\Services\CropSuitability;
use App\Services\DistrictAnalysis;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PredictTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A district shaped like DistrictAnalysis::all() returns it.
     *
     * @param  callable(int, int): float  $rain  rainfall for (year, month)
     */
    private function district(int $id, string $name, string $risk, callable $rain, string $direction = 'agrees'): array
    {
        $series = collect();

        foreach (range(2014, 2024) as $year) {
            foreach (range(1, 12) as $month) {
                $series->push(['year' => $year, 'month' => $month, 'rainfall_mm' => $rain($year, $month)]);
            }
        }

        return [
            'id' => $id,
            'name' => $name,
            'province' => 'Test Province',
            'household_drought_pct' => $risk === 'no_data' ? null : 20.0,
            'rainfall' => $series,
            'history' => [
                'years_covered' => 11,
                'by_calendar_month' => collect(range(1, 12))->map(fn ($m) => ['month' => $m, 'dry_pct' => 10.0])->all(),
            ],
            'summary' => ['risk_level' => $risk, 'direction' => $direction, 'basis_risk_pct' => $risk === 'high' ? 60.0 : 5.0],
        ];
    }

    private function fakeAnalysis(array $districts): void
    {
        $this->mock(DistrictAnalysis::class, fn ($mock) => $mock->shouldReceive('all')->andReturn(collect($districts)));
    }

    private function standardDistricts(): array
    {
        return [
            // Always enough rain in every month: a good season in every year.
            $this->district(1, 'Wetville', 'low', fn () => 120.0),
            // Never enough rain.
            $this->district(2, 'Dryton', 'medium', fn () => 20.0, 'satellite_understates'),
            // Fine on paper, but households and satellite disagree strongly: must not be used.
            $this->district(3, 'Trapland', 'high', fn () => 120.0, 'satellite_understates'),
            // Good in every year except the odd ones.
            $this->district(4, 'Halfway', 'low', fn ($y) => $y % 2 === 0 ? 120.0 : 20.0),
            $this->district(5, 'Unchecked', 'no_data', fn () => 120.0),
        ];
    }

    public function test_chance_estimator_gives_an_honest_range(): void
    {
        $nine = ChanceEstimator::share(9, 10);
        $this->assertSame(90.0, $nine['pct']);
        $this->assertEqualsWithDelta(59.6, $nine['low'], 0.1);
        $this->assertEqualsWithDelta(98.2, $nine['high'], 0.1);

        // 10 of 10 is not "100% certain": the plausible range still reaches well below it.
        $ten = ChanceEstimator::share(10, 10);
        $this->assertSame(100.0, $ten['pct']);
        $this->assertLessThan(75, $ten['low']);

        $none = ChanceEstimator::share(0, 10);
        $this->assertSame(0.0, $none['low']);
        $this->assertGreaterThan(0, $none['high']);

        $this->assertNull(ChanceEstimator::share(0, 0)['pct']);
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

    public function test_untrusted_districts_are_left_out_and_the_rest_are_ranked_by_honest_odds(): void
    {
        $this->fakeAnalysis($this->standardDistricts());

        $result = app(CropSuitability::class)->forCrop('maize');
        $ranked = collect($result['ranking']);

        $this->assertSame(['Trapland'], collect($result['excluded'])->pluck('name')->all());
        $this->assertStringContainsString('no prediction is made', $result['excluded'][0]['reason']);
        $this->assertFalse($ranked->pluck('name')->contains('Trapland'));

        $this->assertSame(['Wetville', 'Unchecked', 'Halfway', 'Dryton'], $ranked->pluck('name')->all());
        $this->assertSame([1, 2, 3, 4], $ranked->pluck('rank')->all());

        $wetville = $ranked->firstWhere('name', 'Wetville');
        $this->assertSame('verified', $wetville['trust']);
        $this->assertSame('high', $wetville['confidence']);
        $this->assertSame(11, $wetville['best']['good']['count']);
        $this->assertSame(11, $wetville['best']['years']);
        $this->assertLessThan(100, $wetville['best']['good']['low']);

        $dryton = $ranked->firstWhere('name', 'Dryton');
        $this->assertSame('usable', $dryton['trust']);
        $this->assertSame(0, $dryton['best']['good']['count']);
        $this->assertStringContainsString('may be lower', $dryton['caveat']);

        // No household value: still ranked, but with low confidence and a warning.
        $unchecked = $ranked->firstWhere('name', 'Unchecked');
        $this->assertSame('unverified', $unchecked['trust']);
        $this->assertSame('low', $unchecked['confidence']);
        $this->assertNotNull($unchecked['caveat']);

        // Half the years are good: the plausible range is wide and the pct is 50-ish of the best usual month.
        $halfway = $ranked->firstWhere('name', 'Halfway');
        $this->assertGreaterThan(0, $halfway['best']['good']['count']);
        $this->assertLessThan($halfway['best']['years'], $halfway['best']['good']['count']);
    }

    public function test_only_the_usual_planting_months_can_be_recommended_but_all_twelve_are_shown(): void
    {
        $this->fakeAnalysis([$this->district(1, 'Wetville', 'low', fn () => 120.0)]);

        $row = app(CropSuitability::class)->forCrop('maize')['ranking'][0];

        $this->assertCount(12, $row['by_month']);
        $this->assertContains($row['best']['month'], [9, 10, 2, 3]);
        $this->assertTrue($row['best']['usual']);
        // Planted in the best month, harvested four months later (maize has a five month cycle).
        $this->assertSame(($row['best']['month'] + 3) % 12 + 1, $row['best']['harvest_month']);
    }

    public function test_api_returns_the_ranking_and_404_for_an_unknown_crop(): void
    {
        $this->fakeAnalysis($this->standardDistricts());

        $this->getJson('/api/predict/crops')->assertOk()->assertJsonPath('data.0.id', 'maize');

        $this->getJson('/api/predict/crops/maize')->assertOk()
            ->assertJsonPath('data.crop.name', 'Maize')
            ->assertJsonPath('data.ranking.0.name', 'Wetville')
            ->assertJsonPath('data.excluded.0.name', 'Trapland')
            ->assertJsonPath('data.period.first_year', 2014);

        $this->getJson('/api/predict/crops/wheat')->assertNotFound();
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

    public function test_chat_prompt_carries_calculated_chances_and_the_honesty_rules(): void
    {
        [$prompt] = $this->ask([['role' => 'user', 'content' => 'Which district is best for maize?']]);

        $this->assertStringContainsString('1. Wetville', $prompt);
        $this->assertStringContainsString('good in 11 of 11 years = 100%', $prompt);
        $this->assertStringContainsString('plausible range', $prompt);
        $this->assertStringContainsString('Never say "will"', $prompt);
        $this->assertStringContainsString('NOT in the database: sunshine, temperature', $prompt);
        $this->assertStringContainsString('Left out, no prediction made:', $prompt);
        $this->assertStringContainsString('Trapland', $prompt);
        $this->assertStringContainsString('NOT TRUSTED, high mismatch risk', $prompt);
        // Maize only, until another crop is asked about.
        $this->assertStringNotContainsString('Beans ranking', $prompt);
        $this->assertStringContainsString('Other crops that can be ranked', $prompt);
    }

    public function test_chat_prompt_follows_the_crop_and_district_in_the_question(): void
    {
        [$prompt] = $this->ask([['role' => 'user', 'content' => 'And ibishyimbo in Halfway?']]);

        $this->assertStringContainsString('Beans ranking', $prompt);
        $this->assertStringContainsString('Beans in Halfway, by planting month', $prompt);
        $this->assertStringContainsString('Year by year for the best month', $prompt);
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
