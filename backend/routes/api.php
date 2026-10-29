<?php

use App\Http\Controllers\DistrictController;
use App\Http\Controllers\OverviewController;
use Illuminate\Support\Facades\Route;

Route::get('/overview', OverviewController::class);
Route::get('/districts', [DistrictController::class, 'index']);
Route::get('/districts/{district}', [DistrictController::class, 'show']);
