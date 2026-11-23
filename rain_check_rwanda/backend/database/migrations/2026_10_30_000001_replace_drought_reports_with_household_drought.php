<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('drought_reports');

        Schema::table('districts', function (Blueprint $table) {
            $table->decimal('household_drought_pct', 5, 2)->nullable()->after('poverty_rate');
        });
    }

    public function down(): void
    {
        Schema::table('districts', function (Blueprint $table) {
            $table->dropColumn('household_drought_pct');
        });
    }
};
