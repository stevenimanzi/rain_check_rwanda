<?php

namespace Tests\Feature;

use App\Models\District;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class HouseholdSurveyImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_requires_the_configured_import_token(): void
    {
        config(['services.imports.token' => 'private-test-token']);

        $response = $this->post('/api/imports/household-drought', [
            'survey_year' => 2025,
            'source_name' => 'Test survey',
            'file' => UploadedFile::fake()->createWithContent(
                'survey.csv',
                "district,household_drought_pct\nGatsibo,42.5\n",
            ),
        ]);

        $response->assertUnauthorized();
        $this->assertDatabaseCount('household_survey_imports', 0);
    }

    public function test_upload_fails_closed_when_no_import_token_is_configured(): void
    {
        config(['services.imports.token' => null]);

        $this->post('/api/imports/household-drought')
            ->assertServiceUnavailable();
    }

    public function test_import_appends_source_labelled_data_without_changing_the_baseline(): void
    {
        config(['services.imports.token' => 'private-test-token']);
        $district = District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken('private-test-token')->post('/api/imports/household-drought', [
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

    public function test_invalid_csv_rows_are_rejected_without_creating_an_import(): void
    {
        config(['services.imports.token' => 'private-test-token']);
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken('private-test-token')->post('/api/imports/household-drought', [
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
        config(['services.imports.token' => 'private-test-token']);
        District::create([
            'name' => 'Gatsibo',
            'province' => 'Eastern',
            'household_drought_pct' => 58.0,
        ]);

        $response = $this->withToken('private-test-token')->post('/api/imports/household-drought', [
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
}
