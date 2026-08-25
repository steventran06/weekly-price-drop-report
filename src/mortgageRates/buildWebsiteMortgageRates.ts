import type {
  MortgageRatePoint,
  WebsiteMortgageRates,
} from "./types.js";
import type {
  MORTGAGE_RATE_SERIES,
} from "./series.js";

export function buildWebsiteMortgageRates(
  series: Record<
    keyof typeof MORTGAGE_RATE_SERIES,
    MortgageRatePoint
  >,
): WebsiteMortgageRates {
  const points =
    Object.values(
      series,
    );

  if (
    points.length !== 17
  ) {
    throw new Error(
      `Expected 17 mortgage-rate series, received ${points.length}.`,
    );
  }

  const dates =
    points
      .map(
        (point) =>
          point.observationDate,
      )
      .sort();

  const latestObservationDate =
    dates[
      dates.length - 1
    ];
  const oldestObservationDate =
    dates[0];

  if (
    !latestObservationDate ||
    !oldestObservationDate
  ) {
    throw new Error(
      "Mortgage-rate series did not contain observation dates.",
    );
  }

  return {
    schemaVersion: 1,
    source: {
      name:
        "Optimal Blue Mortgage Market Indices",
      provider:
        "Federal Reserve Bank of St. Louis (FRED)",
      releaseId: 473,
      releaseUrl:
        "https://fred.stlouisfed.org/release?rid=473",
      optimalBlueUrl:
        "https://www2.optimalblue.com/obmmi",
    },
    fetchedAt:
      new Date().toISOString(),
    freshness: {
      latestObservationDate,
      oldestObservationDate,
      allSeriesSameObservationDate:
        new Set(
          dates,
        ).size === 1,
    },
    products: {
      conforming30:
        series.conforming30,
      conforming30NonAdjusted:
        series.conforming30NonAdjusted,
      conforming15:
        series.conforming15,
      jumbo30:
        series.jumbo30,
      fha30:
        series.fha30,
      va30:
        series.va30,
      usda30:
        series.usda30,
    },
    conforming30ByFicoAndLtv: {
      ltv80OrLess: {
        ficoUnder680:
          series.ltv80OrLessFicoUnder680,
        fico680To699:
          series.ltv80OrLessFico680To699,
        fico700To719:
          series.ltv80OrLessFico700To719,
        fico720To739:
          series.ltv80OrLessFico720To739,
        fico740Plus:
          series.ltv80OrLessFico740Plus,
      },
      ltvOver80: {
        ficoUnder680:
          series.ltvOver80FicoUnder680,
        fico680To699:
          series.ltvOver80Fico680To699,
        fico700To719:
          series.ltvOver80Fico700To719,
        fico720To739:
          series.ltvOver80Fico720To739,
        fico740Plus:
          series.ltvOver80Fico740Plus,
      },
    },
  };
}

export function validateWebsiteMortgageRates(
  data: WebsiteMortgageRates,
): void {
  if (
    data.schemaVersion !== 1
  ) {
    throw new Error(
      "Mortgage-rate payload has an unsupported schema version.",
    );
  }

  const points = [
    ...Object.values(
      data.products,
    ),
    ...Object.values(
      data.conforming30ByFicoAndLtv.ltv80OrLess,
    ),
    ...Object.values(
      data.conforming30ByFicoAndLtv.ltvOver80,
    ),
  ];

  if (
    points.length !== 17
  ) {
    throw new Error(
      `Mortgage-rate payload must contain 17 series; found ${points.length}.`,
    );
  }

  const seenSeries =
    new Set<string>();

  for (
    const point
    of points
  ) {
    if (
      seenSeries.has(
        point.seriesId,
      )
    ) {
      throw new Error(
        `Mortgage-rate payload contains duplicate series ${point.seriesId}.`,
      );
    }

    seenSeries.add(
      point.seriesId,
    );

    if (
      !Number.isFinite(
        point.rate,
      ) ||
      point.rate <= 0 ||
      point.rate >= 25
    ) {
      throw new Error(
        `Mortgage-rate payload contains invalid rate for ${point.seriesId}: ${point.rate}`,
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        point.observationDate,
      )
    ) {
      throw new Error(
        `Mortgage-rate payload contains invalid date for ${point.seriesId}: ${point.observationDate}`,
      );
    }
  }
}
