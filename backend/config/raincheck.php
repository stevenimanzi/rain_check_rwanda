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

    // Official satellite rainfall (CHIRPS v3, monthly, Africa), used for survey periods the stored rainfall
    // does not cover. One GeoTIFF map per month; no account or key is needed.
    'chirps_url' => env('CHIRPS_URL', 'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/africa/tifs'),
    'boundaries_file' => env('RAINCHECK_BOUNDARIES_FILE', base_path('../data/rwanda-districts.geojson')),

    // Normal rainfall per district and calendar month, calculated from the same official maps (2014 to 2024).
    // Rebuild with: php artisan raincheck:satellite-normals
    'satellite_normals_file' => env('RAINCHECK_NORMALS_FILE', base_path('../data/chirps_normals_2014_2024.csv')),

    // Only for PHP installs that cannot verify HTTPS certificates (cURL error 60).
    'ca_bundle' => env('HTTP_CA_BUNDLE', env('GOOGLE_CA_BUNDLE')),
];
