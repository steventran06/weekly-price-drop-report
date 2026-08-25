# Daily Optimal Blue / FRED Mortgage Rates

This patch adds a standalone mortgage-rate workflow to `weekly-price-drop-report`.
It fetches the 17 Optimal Blue Mortgage Market Index series from FRED, creates a normalized website JSON payload, saves a local preview, and can publish that JSON to `steventranrealestate` through the existing GitHub token pattern.

## 1. Install the patch

Unzip this archive into the root of `weekly-price-drop-report`, then run:

```bash
node scripts/installMortgageRates.mjs
npm run build
```

The installer only adds two npm scripts and one `.gitignore` line. It does not replace your current `package.json`.

## 2. Environment variables

Add your FRED key locally and in the Render cron job:

```bash
FRED_API_KEY=YOUR_FRED_API_KEY
```

The publishing job reuses the existing website GitHub variables:

```bash
SITE_GITHUB_TOKEN=...
SITE_GITHUB_OWNER=steventran06
SITE_GITHUB_REPO=steventranrealestate
SITE_GITHUB_BRANCH=main
```

Optional destination override:

```bash
SITE_MORTGAGE_RATES_PATH=data/mortgage-rates.json
```

If omitted, the destination defaults to `data/mortgage-rates.json`.

## 3. Preview first — no GitHub write

```bash
npm run mortgage-rates:preview
```

This fetches live FRED data and writes:

```text
output/mortgage-rates/latest.json
```

It does not publish anything to `steventranrealestate`.

Inspect it with:

```bash
cat output/mortgage-rates/latest.json
```

Send that JSON/output back for review before publishing if you want to tune the website contract.

## 4. Publish manually

Once the preview shape looks right:

```bash
npm run mortgage-rates
```

That updates:

```text
steventranrealestate/data/mortgage-rates.json
```

through the GitHub Contents API.

## 5. Render cron

Command:

```bash
npm run mortgage-rates
```

Render cron schedules are UTC. During Pacific Daylight Time, 6:00 AM Pacific is 13:00 UTC:

```text
0 13 * * 1-5
```

During Pacific Standard Time, 6:00 AM Pacific is 14:00 UTC:

```text
0 14 * * 1-5
```

The OBMMI series are business-day data, so Monday-Friday is the recommended schedule. If you prefer a seven-day cron, replace `1-5` with `*`.

## JSON design

The website payload contains all 17 public OBMMI series:

- 30-year conforming
- 30-year conforming non-adjusted
- 15-year conforming
- 30-year jumbo
- 30-year FHA
- 30-year VA
- 30-year USDA
- 10 detailed 30-year conforming FICO/LTV series

Every rate includes its own `observationDate`, because FRED's detailed FICO/LTV series do not always update on exactly the same day as the headline product series.

Every rate also includes the prior available business-day observation plus:

- `change` in percentage points
- `changeBps` in basis points

This gives the future mortgage calculator a stable local JSON contract without exposing the FRED API key in the browser.
