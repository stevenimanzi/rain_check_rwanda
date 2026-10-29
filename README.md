# RainCheck Rwanda

**Does satellite rainfall match the droughts Rwandan households report?**

Index-based crop insurance pays farmers when satellite rainfall falls below a set level, not when a farm
actually loses its crop. If the satellite and the farmers disagree, a farmer can lose a harvest and get
nothing, or the insurer pays when nothing happened. This gap is called *basis risk*. RainCheck Rwanda
measures when and where each of Rwanda's 30 districts has dry months, and compares that with what NISR
surveyed households reported, so insurers, ministries and lenders can see where satellite insurance can be
trusted.

Built for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion & Poverty Reduction).
Supports the National Financial Inclusion Roadmap 2025-2030 priorities of agriculture insurance and
financial health.

- **Live app:** _add the deployed link here_
- **Demo video (max 3 minutes):** [`docs/demo.webm`](docs/demo.webm)
- No login is required to use the app.

## What the dashboard shows

| Page | What it communicates |
| --- | --- |
| Overview | National rainfall against normal, driest years, riskiest months, and all 30 districts ranked by dry months. |
| Districts | A searchable table of all 30 districts. Click one for its own charts and history. |
| Map | District map of long-term drought risk, dry months in the survey period, and basis risk. |
| Why it matters | National context (poverty, financial inclusion, insurance) with a published source for every figure. |
| For institutions | Who can use the data, CSV downloads, data sources and their status, and how the measures work. |

Every chart has a box underneath saying what it shows, how to read it and where the data comes from.

## How to interact

1. Start on **Overview** and read the explanation under each chart.
2. Open **Districts**, search or filter, and click a district to see its rainfall history, driest years and
   riskiest months.
3. Open **Map** and switch between the three views. Click a district to see its charts below the map.
4. Open **For institutions** to download the data as CSV.

On phones the sidebar becomes a menu opened with the button in the top bar.

## Data used

| Data | Source | Used for | In this repo |
| --- | --- | --- | --- |
| Monthly rainfall, 2014-2024 | [CHIRPS v3](https://www.chc.ucsb.edu/data/chirps3), Climate Hazards Center, UC Santa Barbara | Dry months, drought years, risky months | `data/rainfall.csv` (averaged per district) |
| District boundaries | [geoBoundaries](https://www.geoboundaries.org/) Rwanda ADM2 | Maps and district averages | `frontend/public/rwanda-districts.geojson` |
| Household drought reports and poverty rates | [NISR EICV7 2023/24](https://microdata.statistics.gov.rw/index.php/catalog/119) | Comparing satellite with households (basis risk), poverty | Not included. Download from the NISR portal and import with the commands below. |
| National context figures | Linked beside each figure in the app (NISR, FinScope 2024, National Bank of Rwanda, IFPRI) | The "Why it matters" page | Sources listed in `frontend/src/sources.js` |

Derived data files, ready to use:

- `data/rainfall.csv` - monthly satellite rainfall per district (input to the app)
- `data/monthly_rainfall_vs_normal.csv` - rainfall, normal rainfall and dry-month flag per district and month
- `data/district_summary.csv` - drought history, poverty and basis risk per district

EICV7 microdata is licensed by NISR and is not redistributed here. Request access through the
[NISR Microdata Portal](https://microdata.statistics.gov.rw/index.php/catalog) ("Get Microdata").

## Method

- **Normal rainfall** for a calendar month is the typical (median) rainfall of that month in the other years.
- **Dry month:** rainfall 20% or more below normal. Months that normally get under 50 mm (the June to
  August dry season) are not judged, because small changes look huge there.
- **Reported drought:** 20% or more of surveyed households in a district name drought as a main problem.
- **Basis risk:** share of months where the satellite and households disagree (below 25% low, up to 50% medium,
  above that high).

All thresholds are in `backend/config/raincheck.php`.

**Limits:** satellite rainfall is an estimate, not a farm measurement; household reports are self-reported;
the household comparison needs the EICV7 data imported.

## Stack and layout

- `frontend/` React (Vite), Recharts, Leaflet, Heroicons
- `backend/` Laravel API and MySQL database
- `data-tools/` Python script that turns CHIRPS rasters into district rainfall
- `data/` data files used and produced
- `docs/` demo video

## Run it on any machine

Requires PHP 8.2+, Composer, Node 20+, MySQL and (optionally) Python 3.

```bash
# 1. database: create a MySQL database named rain_check_rwanda
cd backend
composer install
cp .env.example .env          # then set DB_USERNAME and DB_PASSWORD
php artisan key:generate
php artisan migrate --seed
php artisan raincheck:import rainfall ../data/rainfall.csv
php artisan serve             # API on http://127.0.0.1:8000

# 2. in a second terminal
cd frontend
npm install
npm run dev                   # app on http://127.0.0.1:5173
```

Import the NISR EICV7 data (CSV columns are documented in `backend/app/Console/Commands/ImportData.php`):

```bash
php artisan raincheck:import reports ../data/drought_reports.csv
php artisan raincheck:import poverty ../data/poverty.csv
```

Rebuild the rainfall file from satellite data:

```bash
cd data-tools
pip install -r requirements.txt
python chirps_to_csv.py ../frontend/public/rwanda-districts.geojson ../data/rainfall.csv 2014 2024
```

## AI assistance

AI tools (Claude) were used as an assistant during development of this project, as permitted by the
hackathon rules. The authors remain fully responsible for the work.

## Declaration and acknowledgements

We declare that this submission is our own work and that all sources of reference are acknowledged in full:
CHIRPS (Climate Hazards Center), geoBoundaries, NISR (EICV7, press releases), FinScope Rwanda 2024,
National Bank of Rwanda, IFPRI, the Global Inclusive Insurance Facility, and the open-source libraries in
`package.json` and `composer.json`. As the competition rules state, intellectual property rights in this
submission are assigned to the National Institute of Statistics of Rwanda.
