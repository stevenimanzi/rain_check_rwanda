<?php

namespace Tests\Feature;

use App\Models\District;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class HouseholdSurveyImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_importer_login_rejects_invalid_credentials(): void
    {
        $this->configureImporter();

        $this->postJson('/api/imports/household-drought/login', [
            'email' => 'uploader@example.com',
            'password' => 'incorrect',
        ])->assertUnauthorized()
            ->assertJsonPath('message', 'Invalid email or password.');
    }

    public function test_importer_login_fails_closed_when_no_account_is_configured(): void
    {
        config([
            'services.imports.email' => null,
            'services.imports.password' => null,
        ]);

        $this->postJson('/api/imports/household-drought/login', [
            'email' => 'uploader@example.com',
            'password' => 'test-password',
        ])->assertServiceUnavailable();
    }

    public function test_upload_requires_a_valid_importer_login(): void
    {
        $this->post('/api/imports/household-drought', [
            'survey_year' => 2025,
            'source_name' => 'Test survey',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,42.5\n",
            ),
        ])->assertUnauthorized();

        $this->assertDatabaseCount('household_survey_imports', 0);
    }

    public function test_import_appends_source_labelled_data_without_changing_the_baseline(): void
    {
        $district = District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken($this->loginToken())->post('/api/imports/household-drought', [
            'survey_year' => 2025,
            'source_name' => 'Future survey',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,42.5\n",
            ),
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.survey_year', 2025)
            ->assertJsonPath('data.source_name', 'Future survey')
            ->assertJsonPath('data.observations.0.district_name', 'Gatsibo')
            ->assertJsonPath('data.observations.0.household_drought_pct', 42.5);

        $this->assertDatabaseHas('household_drought_observations', [
            'district_id' => $district->id,
            'household_drought_pct' => 42.5,
        ]);
        $this->assertDatabaseHas('districts', [
            'id' => $district->id,
            'household_drought_pct' => 58.0,
        ]);

        $this->getJson('/api/imports/household-drought')
            ->assertOk()
            ->assertJsonPath('data.0.source_name', 'Future survey');
    }

    public function test_preview_returns_the_survey_without_saving_it(): void
    {
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken($this->loginToken())->post('/api/imports/household-drought', [
            'survey_year' => 2026,
            'source_name' => 'Preview survey',
            'mode' => 'preview',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,42.5\n",
            ),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.id', null)
            ->assertJsonPath('data.preview', true)
            ->assertJsonPath('data.survey_year', 2026)
            ->assertJsonPath('data.observations.0.district_name', 'Gatsibo')
            ->assertJsonPath('data.observations.0.household_drought_pct', 42.5);
        $this->assertDatabaseCount('household_survey_imports', 0);
        $this->assertDatabaseCount('household_drought_observations', 0);
    }

    public function test_preview_still_rejects_invalid_files(): void
    {
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $this->withToken($this->loginToken())->post('/api/imports/household-drought', [
            'survey_year' => 2026,
            'source_name' => 'Bad preview',
            'mode' => 'preview',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nNowhere,42.5\n",
            ),
        ])->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_survey_comparison_uses_the_given_values_and_reports_missing_rainfall(): void
    {
        $district = District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);
        $other = District::create([
            'name' => 'Huye',
            'province' => 'Southern',
            'household_drought_pct' => 31.0,
        ]);

        $merged = $this->postJson('/api/survey-comparison', [
            'survey_year' => 2026,
            'view' => 'merged',
            'observations' => [['district_id' => $district->id, 'household_drought_pct' => 12.5]],
        ])->assertOk()
            ->assertJsonPath('data.window.start', '2025-04')
            ->assertJsonPath('data.window.end', '2026-03')
            ->assertJsonPath('data.window.complete', false);

        $byId = collect($merged->json('data.districts'))->keyBy('id');
        $this->assertEquals(12.5, $byId[$district->id]['household_drought_pct']);
        $this->assertEquals(31.0, $byId[$other->id]['household_drought_pct']);

        $imported = $this->postJson('/api/survey-comparison', [
            'survey_year' => 2026,
            'view' => 'imported',
            'observations' => [['district_id' => $district->id, 'household_drought_pct' => 12.5]],
        ])->assertOk();

        $byId = collect($imported->json('data.districts'))->keyBy('id');
        $this->assertEquals(12.5, $byId[$district->id]['household_drought_pct']);
        $this->assertNull($byId[$other->id]['household_drought_pct']);
    }

    public function test_survey_comparison_rejects_unknown_districts_and_bad_percentages(): void
    {
        $this->postJson('/api/survey-comparison', [
            'survey_year' => 2026,
            'view' => 'merged',
            'observations' => [['district_id' => 999, 'household_drought_pct' => 150]],
        ])->assertUnprocessable();
    }

    public function test_signing_out_invalidates_the_importer_access_token(): void
    {
        $token = $this->loginToken();

        $this->withToken($token)
            ->postJson('/api/imports/household-drought/logout')
            ->assertOk();

        $this->withToken($token)
            ->post('/api/imports/household-drought', [
                'survey_year' => 2025,
                'source_name' => 'Signed-out survey',
                'file' => UploadedFile::fake()->createWithContent(
                    'survey.csv',
                    "district,household_drought_pct\nGatsibo,42.5\n",
                ),
            ])
            ->assertUnauthorized();
    }

    public function test_invalid_csv_rows_are_rejected_without_creating_an_import(): void
    {
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken($this->loginToken())->post('/api/imports/household-drought', [
            'survey_year' => 2025,
            'source_name' => 'Invalid survey',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,42.5\nGatsibo,39\n",
            ),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('file');
        $this->assertDatabaseCount('household_survey_imports', 0);
        $this->assertDatabaseCount('household_drought_observations', 0);
    }

    public function test_percentages_over_one_hundred_are_rejected(): void
    {
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken($this->loginToken())->post('/api/imports/household-drought', [
            'survey_year' => 2025,
            'source_name' => 'Out-of-range survey',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,100.1\n",
            ),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('file');
        $this->assertDatabaseCount('household_survey_imports', 0);
    }

    private function configureImporter(): void
    {
        config([
            'services.imports.email' => 'uploader@example.com',
            'services.imports.password' => 'test-password',
        ]);
    }

    private function loginToken(): string
    {
        $this->configureImporter();

        $response = $this->postJson('/api/imports/household-drought/login', [
            'email' => 'uploader@example.com',
            'password' => 'test-password',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.expires_in', 3600);

        return $response->json('data.token');
    }
}
