# Upcoming Events Job Setup

This repo now includes an independent upcoming-events workflow.

## What it does

Run:

```bash
npm run events
```

The job:

1. Fetches upcoming events from the Ticketmaster Discovery API for the configured Portland Metro and SW Washington cities.
2. Looks ahead 120 days by default.
3. Normalizes venue, category, image, date/time, city slug, and latitude/longitude data.
4. Removes duplicate and cancelled events.
5. Publishes the resulting JSON file to the `steventranrealestate` GitHub repository.

Default website destination:

```text
data/events/latest.json
```

## Ticketmaster API key

Create/login to a Ticketmaster Developer account and obtain a Discovery API key.

Add the key to Render as:

```text
TICKETMASTER_API_KEY=<your key>
```

Do not commit the key to GitHub.

## GitHub variables

The event job reuses the same GitHub publishing credentials as the existing market-stats workflow:

```text
SITE_GITHUB_TOKEN=<existing token>
SITE_GITHUB_OWNER=steventran06
SITE_GITHUB_REPO=steventranrealestate
SITE_GITHUB_BRANCH=main
```

Optional destination override:

```text
SITE_EVENTS_PATH=data/events/latest.json
```

## Optional tuning

Defaults:

```text
EVENT_LOOKAHEAD_DAYS=120
EVENT_PAGE_SIZE=100
EVENT_MAX_PAGES_PER_CITY=5
EVENT_REQUEST_DELAY_MS=650
```

You can omit all four unless you want to tune the fetcher.

## Render cron job

Create a new Render Cron Job connected to this repository and branch.

Suggested settings:

```text
Build Command: npm ci
Command: npm run events
Schedule: 0 12 * * *
```

Render cron schedules use UTC. `0 12 * * *` runs daily at 12:00 UTC, which is 5:00 AM Pacific during daylight saving time and 4:00 AM Pacific during standard time.

Set or link the environment variables listed above on the cron job. If the current market-stats Render service already uses an Environment Group containing `SITE_GITHUB_*`, link the same group and add `TICKETMASTER_API_KEY`.

After saving the service, use **Trigger Run** once from the Render dashboard. A successful run should log the number of events found for each city and finish by publishing:

```text
steventranrealestate/data/events/latest.json
```

## Website integration

Each event includes `citySlug` plus venue latitude/longitude when provided by Ticketmaster. The website can immediately filter events by city. Neighborhood filtering should be added when the current `steventranrealestate` location data is wired in, using the event coordinates rather than guessing neighborhood names in this fetcher.
