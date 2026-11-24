<?php

use App\Http\Controllers\DistrictController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\HouseholdSurveyImportController;
use App\Http\Controllers\OverviewController;
use App\Http\Middleware\RequireSurveyImportToken;
use Illuminate\Support\Facades\Route;

Route::get('/overview', OverviewController::class);
Route::get('/districts', [DistrictController::class, 'index']);
Route::get('/districts/{district}', [DistrictController::class, 'show']);

Route::get('/export/districts', [ExportController::class, 'districts']);
Route::get('/export/rainfall', [ExportController::class, 'rainfall']);

Route::get('/imports/household-drought', [HouseholdSurveyImportController::class, 'index']);
Route::post('/imports/household-drought', [HouseholdSurveyImportController::class, 'store'])
    ->middleware([RequireSurveyImportToken::class, 'throttle:10,1']);
