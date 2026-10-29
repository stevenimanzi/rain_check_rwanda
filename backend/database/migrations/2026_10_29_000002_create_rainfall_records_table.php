<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rainfall_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('district_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->decimal('rainfall_mm', 8, 2);
            $table->timestamps();

            $table->unique(['district_id', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rainfall_records');
    }
};
