<?php

use App\Http\Controllers\AssistantController;
use App\Http\Controllers\DistrictController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\HouseholdSurveyImportAuthController;
use App\Http\Controllers\HouseholdSurveyImportController;
use App\Http\Controllers\OverviewController;
use App\Http\Controllers\SurveyComparisonController;
use App\Http\Middleware\RequireHouseholdSurveyImportLogin;
use Illuminate\Support\Facades\Route;

Route::get('/overview', OverviewController::class);
Route::get('/districts', [DistrictController::class, 'index']);
Route::get('/districts/rainfall', [DistrictController::class, 'rainfall']);
Route::get('/districts/{district}', [DistrictController::class, 'show']);

Route::post('/assistant', AssistantController::class)->middleware('throttle:20,1');
Route::post('/survey-comparison', SurveyComparisonController::class)->middleware('throttle:60,1');

Route::get('/export/districts', [ExportController::class, 'districts']);
Route::get('/export/rainfall', [ExportController::class, 'rainfall']);

Route::get('/imports/household-drought', [HouseholdSurveyImportController::class, 'index']);
Route::post('/imports/household-drought/login', [HouseholdSurveyImportAuthController::class, 'login'])
    ->middleware('throttle:5,1');
Route::post('/imports/household-drought/logout', [HouseholdSurveyImportAuthController::class, 'logout'])
    ->middleware(RequireHouseholdSurveyImportLogin::class);
Route::post('/imports/household-drought', [HouseholdSurveyImportController::class, 'store'])
    ->middleware([RequireHouseholdSurveyImportLogin::class, 'throttle:10,1']);
