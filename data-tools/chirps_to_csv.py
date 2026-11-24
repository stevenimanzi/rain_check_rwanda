"""Build the monthly district rainfall CSV from CHIRPS v3 satellite rainfall.

For every month it downloads the Africa GeoTIFF, averages the pixels inside each
district boundary and writes district,year,month,rainfall_mm rows.

Usage:
    python chirps_to_csv.py ../frontend/public/rwanda-districts.geojson ../data/rainfall.csv 2014 2024
"""
import csv
import json
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.mask import mask

BASE_URL = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/monthly/africa/tifs"


def load_districts(path):
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    return [(feature["properties"]["shapeName"], feature["geometry"]) for feature in features]


def download(year, month, folder):
    name = f"chirps-v3.0.{year}.{month:02d}.tif"
    target = folder / name
    response = requests.get(f"{BASE_URL}/{name}", timeout=120)
    if response.status_code != 200:
        return None
    target.write_bytes(response.content)
    return target


def district_means(tif_path, districts):
    rows = []
    with rasterio.open(tif_path) as src:
        for name, geometry in districts:
            data, _ = mask(src, [geometry], crop=True, all_touched=True, nodata=src.nodata)
            values = data[0]
            values = values[(values != src.nodata) & (values >= 0)]
            if values.size:
                rows.append((name, round(float(np.mean(values)), 2)))
    return rows


def process_month(args):
    year, month, districts, folder = args
    tif_path = download(year, month, folder)
    if tif_path is None:
        print(f"{year}-{month:02d}: not available, skipped")
        return []
    rows = [(name, year, month, mm) for name, mm in district_means(tif_path, districts)]
    tif_path.unlink()
    print(f"{year}-{month:02d}: done")
    return rows


def main(boundaries, output, first_year, last_year):
    districts = load_districts(boundaries)
    months = [(y, m) for y in range(first_year, last_year + 1) for m in range(1, 13)]

    with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [(y, m, districts, Path(tmp)) for y, m in months]
        results = list(pool.map(process_month, jobs))

    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["district", "year", "month", "rainfall_mm"])
        for rows in results:
            writer.writerows(rows)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
