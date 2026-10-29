<?php

return [
    // A month counts as a satellite drought when rainfall is this % below the district's normal.
    'rainfall_deficit_threshold' => 20,

    // Months whose normal rainfall is below this many mm are too dry to judge.
    'minimum_normal_mm' => 30,

    // A month counts as a reported drought when this % of surveyed households say they had one.
    'reported_drought_threshold' => 20,

    // Share of months where satellite and households disagree.
    'basis_risk_medium' => 25,
    'basis_risk_high' => 50,

    // EICV7 fieldwork period (YYYY-MM).
    'survey_start' => '2023-10',
    'survey_end' => '2024-10',
];
