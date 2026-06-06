# Thai Beverage Export Monitor

Custom dashboard prototype for monitoring Thai beverage exports using HS 2202 as an industry proxy.

## Run Locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## What Is Included

- `index.html`, `styles.css`, `app.js`: dependency-free dashboard.
- `data/sample_exports.csv`: importable sample CSV shape.
- `scripts/customs_pipeline.py`: starter normalization and validation pipeline for official CSV files.
- `spec.md`: original product spec.

## CSV Schema

The dashboard import expects:

```text
period,hs_code,country,value_fob,quantity,unit,source,downloaded_at
```

`quantity`, `unit`, and `downloaded_at` can be blank. `period` should use `YYYY-MM`.

## Pipeline Example

```bash
python3 scripts/customs_pipeline.py data/sample_exports.csv
```

The script writes raw audit copies to `data/raw`, normalized data to `data/processed/exports_normalized.csv`, and a run log to `data/processed/latest_run.json`.

## Data Caveat

The built-in dataset is synthetic sample data for UI and workflow validation. Replace it with official Customs CSV data before using the dashboard for investment research.
