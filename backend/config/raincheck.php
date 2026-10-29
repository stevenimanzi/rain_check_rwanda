<?php

return [
    // A month counts as a satellite drought when rainfall is this % below the district's normal.
    'rainfall_deficit_threshold' => 20,

    // Months whose normal rainfall is below this many mm are too dry to judge.
    'minimum_normal_mm' => 50,

    // Basis risk is the gap, in percentile points (0-100), between how a district ranks on satellite
    // dry months and how it ranks on households reporting drought.
    'basis_risk_medium' => 25,
    'basis_risk_high' => 50,

    // The 12 months households were asked about in the CFSVA 2024 survey (YYYY-MM).
    'comparison_start' => '2023-04',
    'comparison_end' => '2024-03',
];
