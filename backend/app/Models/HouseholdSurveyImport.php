<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HouseholdSurveyImport extends Model
{
    protected $casts = [
        'survey_year' => 'integer',
    ];

    protected $fillable = [
        'survey_year',
        'source_name',
        'original_filename',
        'file_sha256',
    ];

    public function observations(): HasMany
    {
        return $this->hasMany(HouseholdDroughtObservation::class, 'import_id');
    }
}
