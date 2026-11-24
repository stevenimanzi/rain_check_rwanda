<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('household_survey_imports', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('survey_year');
            $table->string('source_name', 120);
            $table->string('original_filename');
            $table->char('file_sha256', 64);
            $table->timestamps();
            $table->unique(['survey_year', 'source_name', 'file_sha256'], 'survey_import_source_file_unique');
        });

        Schema::create('household_drought_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_id')->constrained('household_survey_imports')->cascadeOnDelete();
            $table->foreignId('district_id')->constrained()->cascadeOnDelete();
            $table->decimal('household_drought_pct', 5, 2);
            $table->timestamps();
            $table->unique(['import_id', 'district_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_drought_observations');
        Schema::dropIfExists('household_survey_imports');
    }
};
