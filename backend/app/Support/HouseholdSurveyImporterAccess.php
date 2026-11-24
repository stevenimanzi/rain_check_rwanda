<?php

namespace App\Support;

class HouseholdSurveyImporterAccess
{
    public static function cacheKey(string $token): string
    {
        return 'household-survey-importer:'.hash('sha256', $token);
    }
}
