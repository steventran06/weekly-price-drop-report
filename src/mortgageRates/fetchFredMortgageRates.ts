import {
  MORTGAGE_RATE_SERIES,
} from "./series.js";
import type {
  FredSeriesObservationsResponse,
  MortgageRatePoint,
} from "./types.js";

const FRED_API_BASE =
  "https://api.stlouisfed.org/fred/series/observations";

const FETCH_CONCURRENCY = 4;
const OBSERVATION_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchFredMortgageRates(): Promise<
  Record<keyof typeof MORTGAGE_RATE_SERIES, MortgageRatePoint>
> {
  const apiKey =
    process.env.FRED_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "FRED_API_KEY is required to fetch mortgage rates.",
    );
  }

  const entries =
    Object.entries(
      MORTGAGE_RATE_SERIES,
    ) as Array<
      [
        keyof typeof MORTGAGE_RATE_SERIES,
        (typeof MORTGAGE_RATE_SERIES)[keyof typeof MORTGAGE_RATE_SERIES],
      ]
    >;

  console.log(
    `Fetching ${entries.length} Optimal Blue / FRED mortgage-rate series...`,
  );

  const resolved = await mapWithConcurrency(
    entries,
    FETCH_CONCURRENCY,
    async ([key, definition]) => {
      const point = await fetchSeriesPoint(
        definition.seriesId,
        definition.name,
        apiKey,
      );

      console.log(
        `${definition.seriesId}: ${point.rate.toFixed(3)}% as of ${point.observationDate}`,
      );

      return [key, point] as const;
    },
  );

  return Object.fromEntries(
    resolved,
  ) as Record<
    keyof typeof MORTGAGE_RATE_SERIES,
    MortgageRatePoint
  >;
}

async function fetchSeriesPoint(
  seriesId: string,
  name: string,
  apiKey: string,
): Promise<MortgageRatePoint> {
  const url = new URL(
    FRED_API_BASE,
  );

  url.searchParams.set(
    "series_id",
    seriesId,
  );
  url.searchParams.set(
    "api_key",
    apiKey,
  );
  url.searchParams.set(
    "file_type",
    "json",
  );
  url.searchParams.set(
    "sort_order",
    "desc",
  );
  url.searchParams.set(
    "limit",
    String(OBSERVATION_LIMIT),
  );

  const controller =
    new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "weekly-price-drop-report-mortgage-rates",
        },
        signal:
          controller.signal,
      },
    );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `FRED series ${seriesId} failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    const payload =
      await response.json() as FredSeriesObservationsResponse;

    const numericObservations =
      (payload.observations ?? [])
        .map((observation) => ({
          date:
            observation.date,
          rate:
            Number(
              observation.value,
            ),
        }))
        .filter(
          (observation) =>
            /^\d{4}-\d{2}-\d{2}$/.test(
              observation.date,
            ) &&
            Number.isFinite(
              observation.rate,
            ),
        );

    const latest =
      numericObservations[0];
    const previous =
      numericObservations[1] ??
      null;

    if (!latest) {
      throw new Error(
        `FRED series ${seriesId} returned no numeric observations.`,
      );
    }

    if (
      latest.rate <= 0 ||
      latest.rate >= 25
    ) {
      throw new Error(
        `FRED series ${seriesId} returned an implausible mortgage rate: ${latest.rate}`,
      );
    }

    const change =
      previous
        ? round(
            latest.rate -
              previous.rate,
            3,
          )
        : null;

    return {
      name,
      seriesId,
      rate:
        round(
          latest.rate,
          3,
        ),
      observationDate:
        latest.date,
      previousRate:
        previous
          ? round(
              previous.rate,
              3,
            )
          : null,
      previousObservationDate:
        previous?.date ??
        null,
      change,
      changeBps:
        change === null
          ? null
          : round(
              change * 100,
              1,
            ),
      fredUrl:
        `https://fred.stlouisfed.org/series/${seriesId}`,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        `FRED series ${seriesId} timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results =
    new Array<R>(
      values.length,
    );
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (
        index >=
        values.length
      ) {
        return;
      }

      results[index] =
        await worker(
          values[index],
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            Math.max(
              1,
              concurrency,
            ),
            values.length,
          ),
      },
      () => runWorker(),
    ),
  );

  return results;
}

function round(
  value: number,
  decimals: number,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}
