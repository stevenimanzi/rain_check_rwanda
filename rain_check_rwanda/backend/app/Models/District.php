<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class District extends Model
{
    protected $fillable = ['name', 'province', 'poverty_rate', 'household_drought_pct'];

    public function rainfallRecords(): HasMany
    {
        return $this->hasMany(RainfallRecord::class);
    }
}
