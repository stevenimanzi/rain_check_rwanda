<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\RainfallRecord;
use App\Services\LanguageDetector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssistantTest extends TestCase
{
    use RefreshDatabase;

    private function ask(string $question, array $extra = []): array
    {
        config(['services.google.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'ok']]]]],
        ])]);

        $district = District::create(['name' => 'Huye', 'province' => 'Southern Province', 'poverty_rate' => 24.2, 'household_drought_pct' => 31]);
        District::create(['name' => 'Gasabo', 'province' => 'Kigali City', 'household_drought_pct' => 8]);
        foreach ([2021, 2022, 2023, 2024] as $year) {
            RainfallRecord::create(['district_id' => $district->id, 'year' => $year, 'month' => 4, 'rainfall_mm' => 100 + $year - 2021]);
        }

        $this->postJson('/api/assistant', ['messages' => [['role' => 'user', 'content' => $question]]] + $extra)->assertOk();

        $sent = null;
        Http::assertSent(function ($request) use (&$sent) {
            $sent = $request['systemInstruction']['parts'][0]['text'];

            return true;
        });

        return [$sent];
    }

    public function test_kinyarwanda_question_forces_a_kinyarwanda_reply_whatever_the_page_language(): void
    {
        [$prompt] = $this->ask('Mbwira uturere dufite amapfa menshi', ['page_language' => 'en']);

        $this->assertStringContainsString('written in Kinyarwanda', $prompt);
        $this->assertStringContainsString('even if the page language is English', $prompt);
    }

    public function test_english_question_does_not_force_kinyarwanda(): void
    {
        [$prompt] = $this->ask('Which districts have the biggest mismatch?', ['page_language' => 'rw']);

        $this->assertStringNotContainsString('written in Kinyarwanda. Reply', $prompt);
        $this->assertStringContainsString('Reply in the language the user', $prompt);
    }

    public function test_prompt_is_built_from_the_database(): void
    {
        [$prompt] = $this->ask('Tell me about Huye');

        $this->assertStringContainsString('Huye | Southern Province | households reporting drought: 31%', $prompt);
        $this->assertStringContainsString('poverty rate: 24.2%', $prompt);
        $this->assertStringContainsString('2 districts in 2 provinces', $prompt);
        $this->assertStringContainsString('4 monthly satellite rainfall records, 2021 to 2024', $prompt);
        $this->assertStringContainsString('Huye district, every month', $prompt);
        $this->assertStringNotContainsString('Gasabo district, every month', $prompt);
    }

    public function test_prompt_tells_the_model_how_to_refuse_unrelated_questions(): void
    {
        [$prompt] = $this->ask('Who won the football match?');

        $this->assertStringContainsString("I don't have data about that", $prompt);
        $this->assertStringContainsString('Nta makuru mfite kuri ibyo', $prompt);
    }

    public function test_language_detector(): void
    {
        $detector = new LanguageDetector;

        foreach (['Mbwira uturere dufite amapfa menshi', 'Ni iki basis risk?', 'Imvura yaguye gute muri Huye?', 'Muraho'] as $text) {
            $this->assertTrue($detector->isKinyarwanda($text), $text);
        }

        foreach (['Which districts have the biggest mismatch?', 'What is a dry month?', 'Quels districts ont le plus grand écart ?', 'Huye', 'Why do we see he said'] as $text) {
            $this->assertFalse($detector->isKinyarwanda($text), $text);
        }
    }
}
