# RainCheck Rwanda

**Does satellite rainfall match the droughts Rwandan households report?**

Weather-index crop insurance uses rainfall measurements as a proxy for farm losses. When satellite
rainfall indicators do not align with households' reported drought, this mismatch—known as *basis risk*—
can make a rainfall trigger an imperfect reflection of farmers' experience. RainCheck Rwanda compares,
for all 30 districts, dry months derived from satellite rainfall with households' drought reports in
NISR's 2024 survey. It helps identify where rainfall-based indicators may need further local validation.

**NISR 2026 Big Data Hackathon: Track 3 — Open Innovation.** The project applies NISR household survey
data and public satellite rainfall data to agricultural climate-risk analysis, supporting evidence-based
review of rainfall-index insurance.

- **Live app:** https://raincheckrwandaweb.onrender.com/
- **Live API:** https://raincheck-api-7nk6.onrender.com/api/districts (free hosting: the first visit after a quiet period can take up to a minute)
- **Demo video:** [Watch on Google Drive](https://drive.google.com/file/d/120aN5DEMFl_chRu0nOqf91GwlUniZbLJ/view?usp=drive_link)
- No login is required for read-only use. Survey imports require a private backend token.

## Main finding

Across the 30 districts, satellite dry months and households reporting drought agree only weakly
(rank correlation about 0.06). Six districts have high basis risk. In Gatsibo, 58% of households reported
drought in the year to March 2024, yet the satellite saw one dry month and rainfall was above normal.
This difference highlights where a rainfall indicator may not reflect reported household experience.

**Scope:** RainCheck is a historical comparison and decision-support tool. It does not observe crop
losses, insurance enrollment, claims or payouts, and it does not forecast future drought. Its findings
can guide further investigation; they are not insurance payout determinations.

## What the dashboard shows

| Page | What it communicates |
| --- | --- |
| Overview | Choose districts and a household survey; satellite rainfall, dry months and mismatch comparisons use the same 12-month survey period. |
| Districts | A searchable, filterable table of all 30 districts. Click one for its matched-period comparison and rainfall. |
| Map | District map of dry months in the matched survey period, household drought reports, and basis risk. |
| For institutions | Who can use the data, CSV downloads, data sources and how the measures work. |

Every chart has a box underneath saying what it shows, how to read it and where the data comes from.

## How to interact

1. Start on **Overview** and read the explanation under each chart.
2. Open **Districts**, search or filter by risk level, and click a district to see its matched-period comparison.
3. Open **Map** and switch between the four views. Click a district to see its charts below the map.
4. Open **For institutions** to download data. On **Overview**, use the **Import survey data** button beside the filters to upload a district household CSV.

## Import another household survey

The **Overview** page accepts a CSV with `district` and `household_drought_pct` columns. Download the provided template, fill in percentages from 0 to 100, enter the survey year and source name, then sign in with the survey uploader account and upload the file. District names must match the dashboard; blank percentage rows are skipped, so partial coverage is allowed. Files are limited to 1 MiB, and unknown or repeated districts are rejected.

Imports are stored as separate source- and year-labelled records. **Imported data only** shows one chosen upload. **Merge selected upload with CFSVA 2024** uses that upload where it has values and fills districts missing from the upload with the existing CFSVA 2024 values; values are never averaged or overwritten in storage. The household pie and district bars follow this selection, while mismatch comparisons use the 12 months the selected survey asked about. Select multiple districts to compare each separately; rainfall trend charts average only the selected districts.

### Satellite rainfall for a new survey

A survey for year Y is compared with April of year Y-1 to March of year Y. When the project does not hold rainfall for that period, the dashboard fetches it from the official CHIRPS v3 monthly maps (no account or API key), one month per request, shows the progress, and updates the comparison when all 12 months are ready. Only the part of each map that covers Rwanda is downloaded. A month appears about two weeks after it ends; until the whole period is published, the comparison stays on CFSVA 2024.

Downloaded months are stored in their own table, separate from `data/rainfall.csv`. A comparison uses one of the two sources for its whole period, never a mix. Normal rainfall for downloaded months is the 2014-2024 median in `data/chirps_normals_2014_2024.csv`, calculated from the same official maps with `php artisan raincheck:satellite-normals`.

`data/sample_household_survey_2026.csv` holds made-up values for trying this: import it with survey year 2026 to compare April 2025 to March 2026.

Set `IMPORT_EMAIL` and a long, unique `IMPORT_PASSWORD` privately in `backend/.env` for local use or in the backend service's environment settings on Render. Generate a strong password with:

```bash
php -r "echo bin2hex(random_bytes(24)), PHP_EOL;"
```

Never put these credentials in a `VITE_*` variable or commit them to the repository. Sign-in creates a short-lived access token kept only in application memory; signing out or waiting an hour invalidates it.

On phones the sidebar becomes a menu opened with the button in the top bar.

## Data used

| Data | Source | Used for | In this repo |
| --- | --- | --- | --- |
| Monthly rainfall, April 2023 to March 2024 (the household window; each month also stores its normal, from 2014-2024) | [CHIRPS v3 monthly Africa GeoTIFFs](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/africa/tifs/), Climate Hazards Center, UC Santa Barbara | Dry months, drought years, risky months | `data/rainfall.csv` (averaged per district) |
| Monthly rainfall for the period of an imported survey that is not covered above; normals from 2014-2024 | The same CHIRPS v3 maps, fetched when needed | Comparing newer surveys with the satellite | `data/chirps_normals_2014_2024.csv`, `data/rwanda-districts.geojson` |
| District boundaries | [geoBoundaries](https://www.geoboundaries.org/) Rwanda ADM2 | Maps and district averages | `frontend/public/rwanda-districts.geojson` |
| Households reporting drought, by district | [NISR Statistics Portal and WFP, Rwanda CFSVA 2024](https://statistics.gov.rw/sites/default/files/documents/2025-07/Rwanda%20CFSVA%202024.pdf), Figure 8.4 | Comparing satellite with what households experienced | `data/household_drought_cfsva_2024.csv` |

The NISR-derived household values link to official publications hosted on the NISR Statistics Portal. CHIRPS is
a satellite-and-gauge rainfall dataset produced by the Climate Hazards Center at UC Santa
Barbara, not by NISR. District boundaries come from geoBoundaries. Uploaded surveys show the source name entered
by the uploader and are not independently verified by NISR.

Derived files, ready to use:

- `data/rainfall.csv` - rainfall and normal rainfall per district and month for the household window
- `data/district_summary.csv` - household reports, satellite history and basis risk per district

**How the household figures were obtained.** The CFSVA report publishes the district drought shares only as a
stacked bar chart with no printed values. The drought segment of each of the 30 bars was measured from the
chart image against its axis, and cross-checked against the figures quoted in the report text (for example
Gisagara 39%, measured 38.4%). Values are rounded and accurate to about one percentage point.

## Method

- **Normal rainfall** for a calendar month is the typical (median) rainfall of that month in the other years.
- **Dry month:** rainfall 20% or more below normal. Months that normally get under 50 mm (the June to
  August dry season) are not judged, because small changes look huge there.
- **Comparison period:** April 2023 to March 2024, the 12 months households were asked about in CFSVA 2024
  (fieldwork April 2024).
- **Satellite display and comparison:** use only the same 12 months as the selected household survey. Earlier satellite
  observations remain in the database only to calculate each calendar month's historical normal.
- **Overview pies:** the satellite share classifies Rwanda's average rainfall by month in this period, excluding
  normally very dry months; the household share is the unweighted average of the 30 district estimates, not a
  population-weighted national prevalence.
- Each district is ranked 0-100 on satellite dry months and on the share of households reporting drought.
  **Basis risk** is the gap between the two ranks: below 25 points low, up to 50 medium, above that high.

All thresholds are in `backend/config/raincheck.php`.

**Limits:** satellite rainfall is an estimate on a 5 km grid, not a farm measurement; household answers are
self-reported; dry spells shorter than a month are not visible in monthly rainfall; the household figures were
read from a chart.

## Stack and layout

- `frontend/` React (Vite), Recharts, Leaflet, Heroicons
- `backend/` Laravel API and MySQL database
- `data-tools/` Python script that turns CHIRPS rasters into district rainfall
- `data/` data files used and produced
- `docs/` demo GIF

## Run it on any machine

Requires PHP 8.2+, Composer, Node 20+, MySQL and (optionally) Python 3.

```bash
# 1. database: create a MySQL database named rain_check_rwanda
cd backend
composer install
cp .env.example .env          # then set DB_USERNAME and DB_PASSWORD
php artisan key:generate
# Set private IMPORT_EMAIL and IMPORT_PASSWORD values in .env before enabling survey uploads.
php artisan migrate --seed
php artisan raincheck:import rainfall ../data/rainfall.csv
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

## Host it on Render

The repo has a `Dockerfile` for the API and a start script that creates the tables and loads the data.

1. Create a PostgreSQL database on Render (Laravel works with MySQL or PostgreSQL).
2. Create a **Web Service** from this repo: language Docker, root directory empty. Set `APP_KEY`
   (from `php artisan key:generate --show`), `APP_ENV=production`, `APP_DEBUG=false`, `DB_CONNECTION=pgsql`
   and `DB_URL` (the database's internal URL). Set private `IMPORT_EMAIL` and `IMPORT_PASSWORD` values in the backend environment settings; do not expose them as `VITE_*` variables.
3. Create a **Static Site** from this repo: root directory `frontend`, build command
   `npm install && npm run build`, publish directory `dist`, and `VITE_API_URL` set to
   `https://<your-api-service>.onrender.com/api`.

Free Render web services go to sleep when nobody uses them, so the first visit can take up to a minute.

## AI assistance

AI tools were used as an assistant during development of this project, as permitted by the
hackathon rules. The authors remain fully responsible for the work.

## Declaration and acknowledgements

We declare that this submission is our own work and that all sources of reference are acknowledged in full:
CHIRPS (Climate Hazards Center), geoBoundaries, NISR and WFP (CFSVA 2024), and
the open-source libraries in `package.json` and `composer.json`. As the competition rules state, intellectual
property rights in this submission are assigned to the National Institute of Statistics of Rwanda.
