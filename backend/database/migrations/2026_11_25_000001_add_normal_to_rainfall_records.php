<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The normal rainfall for that district and month, kept so dry months can still be judged
        // after the older years are removed.
        Schema::table('rainfall_records', function (Blueprint $table) {
            $table->decimal('normal_mm', 8, 2)->nullable()->after('rainfall_mm');
        });
    }

    public function down(): void
    {
        Schema::table('rainfall_records', function (Blueprint $table) {
            $table->dropColumn('normal_mm');
        });
    }
};
