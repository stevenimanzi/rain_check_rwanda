<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DroughtReport extends Model
{
    protected $fillable = [
        'district_id',
        'year',
        'month',
        'households_surveyed',
        'households_reporting_drought',
    ];

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }
}
