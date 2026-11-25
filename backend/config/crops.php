<?php

/**
 * What each crop needs from the rain, used by the Predict Future page.
 *
 * These are rounded, approximate reference values in the spirit of the FAO crop water guidelines
 * (FAO Irrigation and Drainage Papers 33 and 56). They describe a typical Rwandan season, not a
 * particular variety or altitude, and an agronomist can change them here without touching any code.
 * Rain is the only thing judged: sunshine, temperature, soil and pests are not in the project data.
 *
 * A planting window starts in a month and lasts `cycle_months` months. It is then judged on three checks:
 *  - season rain: the total over the whole cycle against good_mm and fail_mm (millimetres);
 *  - dry months: months of the growing part of the cycle (all months except `ripening_months`) with less than
 *    min_monthly_mm of rain; none is good, one is marginal, two or more is poor;
 *  - flowering: the rain in the critical month (counted from 1 at planting) against flowering_min_mm and flowering_fail_mm.
 * Any month above wet_month_mm also makes the window marginal (waterlogging, disease).
 * The window's verdict is the worst of the checks: good, marginal or poor.
 */
return [
    'maize' => [
        'name' => 'Maize',
        'cycle_months' => 5,
        'ripening_months' => 1,
        'flowering_month' => 3,
        'good_mm' => [500, 900],
        'fail_mm' => [350, 1200],
        'min_monthly_mm' => 60,
        'flowering_min_mm' => 70,
        'flowering_fail_mm' => 40,
        'wet_month_mm' => 300,
        // Months Rwandan farmers usually plant: season A (September, October) and season B (February, March).
        'usual_planting_months' => [9, 10, 2, 3],
        'note' => 'Maize is most sensitive to dry weather in the flowering month, about 2 to 3 months after planting.',
    ],

    'beans' => [
        'name' => 'Beans',
        'cycle_months' => 4,
        'ripening_months' => 1,
        'flowering_month' => 2,
        'good_mm' => [300, 600],
        'fail_mm' => [220, 900],
        'min_monthly_mm' => 40,
        'flowering_min_mm' => 50,
        'flowering_fail_mm' => 25,
        'wet_month_mm' => 300,
        'usual_planting_months' => [9, 2, 3],
        'note' => 'Beans need less rain than maize but suffer from drought at flowering and from heavy rain at harvest.',
    ],

    'sorghum' => [
        'name' => 'Sorghum',
        'cycle_months' => 5,
        'ripening_months' => 1,
        'flowering_month' => 3,
        'good_mm' => [400, 700],
        'fail_mm' => [300, 1000],
        'min_monthly_mm' => 40,
        'flowering_min_mm' => 50,
        'flowering_fail_mm' => 25,
        'wet_month_mm' => 300,
        'usual_planting_months' => [9, 10, 2, 3],
        'note' => 'Sorghum is one of the most drought tolerant cereals, but it still needs rain around flowering.',
    ],

    'potato' => [
        'name' => 'Irish potato',
        'cycle_months' => 4,
        'ripening_months' => 1,
        'flowering_month' => 2,
        'good_mm' => [450, 800],
        'fail_mm' => [350, 1100],
        'min_monthly_mm' => 50,
        'flowering_min_mm' => 60,
        'flowering_fail_mm' => 30,
        'wet_month_mm' => 300,
        'usual_planting_months' => [9, 10, 2, 3],
        'note' => 'Potato needs steady rain while tubers form (month 2), but very wet months bring blight and rot.',
    ],

    // Words people use for each crop in a question, in English, French and Kinyarwanda.
    'aliases' => [
        'maize' => ['maize', 'corn', 'maïs', 'mais', 'ibigori', 'igikoma'],
        'beans' => ['bean', 'beans', 'haricot', 'haricots', 'ibishyimbo'],
        'sorghum' => ['sorghum', 'sorgho', 'amasaka'],
        'potato' => ['potato', 'potatoes', 'pomme de terre', 'ibirayi'],
    ],
];
