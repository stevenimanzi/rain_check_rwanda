<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drought_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedInteger('households_surveyed');
            $table->unsignedInteger('households_reporting_drought');
            $table->timestamps();

            $table->unique(['district_id', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drought_reports');
    }
};
