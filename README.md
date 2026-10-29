# RainCheck Rwanda

**Does satellite rainfall match the droughts Rwandan households report?**

Index-based crop insurance pays farmers when satellite rainfall falls below a set level, not when a farm
actually loses its crop. If the satellite and the farmers disagree, a farmer can lose a harvest and get
nothing, or the insurer pays when nothing happened. This gap is called *basis risk*. RainCheck Rwanda
compares, for all 30 districts, how many dry months the satellite saw with the share of households that
reported drought in NISR's 2024 survey, so insurers, ministries and lenders can see where satellite
insurance can be trusted and where it cannot.

Built for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion & Poverty Reduction).

- **Live app:** _add the deployed link here_
- **Demo video (max 3 minutes):** [`docs/demo.webm`](docs/demo.webm)
- No login is required to use the app.

## Main finding

Across the 30 districts, satellite dry months and households reporting drought agree only weakly
(rank correlation about 0.06). Six districts have high basis risk. In Gatsibo, 58% of households reported
drought in the year to March 2024, yet the satellite saw one dry month and rainfall was above normal.
Insurance paid on satellite rainfall alone would have left many of those farmers unpaid.

## What the dashboard shows

| Page | What it communicates |
| --- | --- |
| Overview | Where satellite and households disagree, national rainfall against normal, driest years and riskiest months, and all 30 districts ranked on dry months, households reporting drought, long-term risk and poverty. |
| Districts | A searchable, filterable table of all 30 districts. Click one for its own comparison, rainfall and history. |
| Map | District map of long-term drought risk, recent dry months, households reporting drought, and basis risk. |
| For institutions | Who can use the data, CSV downloads, data sources and their status, and how the measures work. |

Every chart has a box underneath saying what it shows, how to read it and where the data comes from.

## How to interact

1. Start on **Overview** and read the explanation under each chart.
2. Open **Districts**, search or filter by risk level, and click a district to see its comparison and history.
3. Open **Map** and switch between the four views. Click a district to see its charts below the map.
4. Open **For institutions** to download the data as CSV.

On phones the sidebar becomes a menu opened with the button in the top bar.

## Data used

| Data | Source | Used for | In this repo |
| --- | --- | --- | --- |
| Monthly rainfall, 2014-2024 | [CHIRPS v3](https://www.chc.ucsb.edu/data/chirps3), Climate Hazards Center, UC Santa Barbara | Dry months, drought years, risky months | `data/rainfall.csv` (averaged per district) |
| District boundaries | [geoBoundaries](https://www.geoboundaries.org/) Rwanda ADM2 | Maps and district averages | `frontend/public/rwanda-districts.geojson` |
| Households reporting drought, by district | [NISR and WFP, Rwanda CFSVA 2024](https://statistics.gov.rw/sites/default/files/documents/2025-07/Rwanda%20CFSVA%202024.pdf), Figure 8.4 | Comparing satellite with what households experienced | `data/household_drought_cfsva_2024.csv` |
| Poverty rate by district | [NISR EICV7 Poverty Profile 2023/24](https://statistics.gov.rw/sites/default/files/documents/2025-07/EICV7_Poverty%20Profile.pdf), Annex B | Showing where drought and poverty overlap | `data/poverty_eicv7_2024.csv` |

Derived files, ready to use:

- `data/monthly_rainfall_vs_normal.csv` - rainfall, normal rainfall and dry-month flag per district and month
- `data/district_summary.csv` - poverty, households reporting drought, satellite history and basis risk per district

**How the household figures were obtained.** The CFSVA report publishes the district drought shares only as a
stacked bar chart with no printed values. The drought segment of each of the 30 bars was measured from the
chart image against its axis, and cross-checked against the figures quoted in the report text (for example
Gisagara 39%, measured 38.4%). Values are rounded and accurate to about one percentage point. The poverty
rates are typed from the printed table in Annex B.

## Method

- **Normal rainfall** for a calendar month is the typical (median) rainfall of that month in the other years.
- **Dry month:** rainfall 20% or more below normal. Months that normally get under 50 mm (the June to
  August dry season) are not judged, because small changes look huge there.
- **Comparison period:** April 2023 to March 2024, the 12 months households were asked about in CFSVA 2024
  (fieldwork April 2024).
- Each district is ranked 0-100 on satellite dry months and on the share of households reporting drought.
  **Basis risk** is the gap between the two ranks: below 25 points low, up to 50 medium, above that high.

All thresholds are in `backend/config/raincheck.php`.

**Limits:** satellite rainfall is an estimate on a 5 km grid, not a farm measurement; household answers are
self-reported; dry spells shorter than a month are not visible in monthly rainfall; the household figures were
read from a chart. A natural next step is to repeat the comparison month by month with the EICV7 microdata,
available from the [NISR Microdata Portal](https://microdata.statistics.gov.rw/index.php/catalog).

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
php artisan raincheck:import poverty ../data/poverty_eicv7_2024.csv
php artisan raincheck:import household-drought ../data/household_drought_cfsva_2024.csv
php artisan serve             # API on http://127.0.0.1:8000

# 2. in a second terminal
cd frontend
npm install
npm run dev                   # app on http://127.0.0.1:5173
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
CHIRPS (Climate Hazards Center), geoBoundaries, NISR (EICV7 Poverty Profile), NISR and WFP (CFSVA 2024), and
the open-source libraries in `package.json` and `composer.json`. As the competition rules state, intellectual
property rights in this submission are assigned to the National Institute of Statistics of Rwanda.
