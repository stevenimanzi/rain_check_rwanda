<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HouseholdDroughtObservation extends Model
{
    protected $fillable = [
        'district_id',
        'household_drought_pct',
    ];

    protected $casts = [
        'district_id' => 'integer',
        'household_drought_pct' => 'float',
    ];

    public function surveyImport(): BelongsTo
    {
        return $this->belongsTo(HouseholdSurveyImport::class, 'import_id');
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }
}
