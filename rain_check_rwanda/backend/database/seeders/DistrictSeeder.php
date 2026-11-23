<?php

namespace Database\Seeders;

use App\Models\District;
use Illuminate\Database\Seeder;

class DistrictSeeder extends Seeder
{
    private const DISTRICTS = [
        'Kigali City' => ['Gasabo', 'Kicukiro', 'Nyarugenge'],
        'Southern Province' => [
            'Gisagara', 'Huye', 'Kamonyi', 'Muhanga',
            'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango',
        ],
        'Western Province' => [
            'Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke',
            'Rubavu', 'Rusizi', 'Rutsiro',
        ],
        'Northern Province' => ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
        'Eastern Province' => [
            'Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe',
            'Ngoma', 'Nyagatare', 'Rwamagana',
        ],
    ];

    public function run(): void
    {
        foreach (self::DISTRICTS as $province => $names) {
            foreach ($names as $name) {
                District::updateOrCreate(['name' => $name], ['province' => $province]);
            }
        }
    }
}
