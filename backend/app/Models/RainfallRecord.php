<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RainfallRecord extends Model
{
    protected $fillable = ['district_id', 'year', 'month', 'rainfall_mm'];

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }
}
