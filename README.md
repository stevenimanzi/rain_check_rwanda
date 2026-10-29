# RainCheck Rwanda

Does satellite rainfall match the droughts Rwandan households report? Index-based crop insurance pays out
on satellite rainfall, so districts where the satellite and farmers disagree carry high "basis risk".
RainCheck Rwanda measures that gap for all 30 districts.

Built for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion & Poverty Reduction).

## Stack

- **Frontend:** React (Vite), Recharts, Leaflet, Heroicons
- **Backend:** Laravel API
- **Database:** MySQL
- **Data tools:** Python script that turns CHIRPS satellite rainfall into district rainfall

## Data

| Data | Source |
| --- | --- |
| Monthly rainfall | CHIRPS v3 (Climate Hazards Center, UC Santa Barbara) |
| District boundaries | geoBoundaries Rwanda ADM2 |
| Household drought reports, poverty | EICV7 2023/24, NISR (imported from CSV) |

## Method

- Satellite drought month: rainfall 20% or more below the district's normal for that calendar month.
- Reported drought month: 20% or more of surveyed households report drought as a main problem.
- Basis risk: share of months where the two disagree (low < 25%, medium 25-50%, high 50%+).

Thresholds are in `backend/config/raincheck.php`.

## Run it

```bash
# database: create a MySQL database named rain_check_rwanda, then set DB_* in backend/.env
cd backend
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan raincheck:import rainfall ../data/rainfall.csv
php artisan serve

# in another terminal
cd frontend
npm install
npm run dev
```

Import survey data with `raincheck:import reports <file>` and `raincheck:import poverty <file>`.
CSV columns are documented in `backend/app/Console/Commands/ImportData.php`.

Rebuild the rainfall file:

```bash
cd data-tools
pip install -r requirements.txt
python chirps_to_csv.py ../frontend/public/rwanda-districts.geojson ../data/rainfall.csv 2014 2024
```

## AI assistance

AI tools (Claude) were used as an assistant during development of this project, as permitted by the
hackathon rules. The author remains responsible for the work.
