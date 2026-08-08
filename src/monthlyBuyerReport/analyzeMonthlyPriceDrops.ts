import type {
  HistoricalPriceDropSnapshot,
} from "./loadHistoricalMonth.js";

export interface MonthlyPriceDropListing {
  key: string;

  mlsNumber: string | null;
  address: string | null;
  area: string | null;

  currentPrice: number | null;
  originalPrice: number | null;
  totalPriceReduction: number | null;

  reductionPercent: number | null;

  firstSeenDate: string;
  lastSeenDate: string;

  appearances: number;
}

export interface PriceDropAreaSummary {
  area: string;

  uniqueListings: number;

  listingsWithKnownReduction: number;

  averageReduction: number | null;
  medianReduction: number | null;

  averageReductionPercent: number | null;
  medianReductionPercent: number | null;

  largestReduction: number | null;
}

export interface MonthlyPriceDropAnalysis {
  snapshotCount: number;

  snapshotDates: string[];

  totalListingOccurrences: number;

  uniqueListings: number;

  listingsWithKnownReduction: number;

  averageReduction: number | null;
  medianReduction: number | null;

  averageReductionPercent: number | null;
  medianReductionPercent: number | null;

  largestReduction: number | null;

  largestReductionPercent: number | null;

  topReductions:
    MonthlyPriceDropListing[];

  areas:
    PriceDropAreaSummary[];

  areasWithMostPriceDrops:
    PriceDropAreaSummary[];

  areasWithLargestMedianReduction:
    PriceDropAreaSummary[];
}

interface RawListing {
  mlsNumber?: unknown;
  mls?: unknown;

  address?: unknown;
  fullAddress?: unknown;

  area?: unknown;
  city?: unknown;
  neighborhood?: unknown;

  currentPrice?: unknown;
  price?: unknown;

  originalPrice?: unknown;
  originalListPrice?: unknown;

  totalPriceReduction?: unknown;
  priceReduction?: unknown;
}

interface ListingObservation {
  snapshotDate: string;

  mlsNumber: string | null;
  address: string | null;
  area: string | null;

  currentPrice: number | null;
  originalPrice: number | null;
  totalPriceReduction: number | null;
}

export function analyzeMonthlyPriceDrops(
  snapshots:
    HistoricalPriceDropSnapshot[],
): MonthlyPriceDropAnalysis {
  const sortedSnapshots =
    [...snapshots].sort(
      (a, b) =>
        a.snapshotDate.localeCompare(
          b.snapshotDate,
        ),
    );

  const observations:
    ListingObservation[] = [];

  for (
    const snapshot
    of sortedSnapshots
  ) {
    for (
      const rawListing
      of snapshot.listings
    ) {
      if (
        !isObject(
          rawListing,
        )
      ) {
        continue;
      }

      observations.push(
        normalizeListing(
          rawListing as RawListing,
          snapshot.snapshotDate,
        ),
      );
    }
  }

  /*
   * Group duplicate weekly appearances
   * of the same property together.
   */
  const grouped =
    new Map<
      string,
      ListingObservation[]
    >();

  for (
    const observation
    of observations
  ) {
    const key =
      createListingKey(
        observation,
      );

    if (
      !key
    ) {
      continue;
    }

    const existing =
      grouped.get(
        key,
      ) ?? [];

    existing.push(
      observation,
    );

    grouped.set(
      key,
      existing,
    );
  }

  const uniqueListings =
    [...grouped.entries()]
      .map(
        ([key, records]) =>
          createMonthlyListing(
            key,
            records,
          ),
      )
      .sort(
        (a, b) =>
          (
            b.totalPriceReduction ??
            0
          ) -
          (
            a.totalPriceReduction ??
            0
          ),
      );

  const listingsWithKnownReduction =
    uniqueListings.filter(
      (listing) =>
        listing.totalPriceReduction !==
          null &&
        listing.totalPriceReduction >
          0,
    );

  const reductionValues =
    listingsWithKnownReduction
      .map(
        (listing) =>
          listing.totalPriceReduction,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
          null,
      );

  const reductionPercentValues =
    listingsWithKnownReduction
      .map(
        (listing) =>
          listing.reductionPercent,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
          null,
      );

  const areas =
    createAreaSummaries(
      listingsWithKnownReduction,
    );

  return {
    snapshotCount:
      sortedSnapshots.length,

    snapshotDates:
      sortedSnapshots.map(
        (snapshot) =>
          snapshot.snapshotDate,
      ),

    totalListingOccurrences:
      observations.length,

    uniqueListings:
      uniqueListings.length,

    listingsWithKnownReduction:
      listingsWithKnownReduction.length,

    averageReduction:
      average(
        reductionValues,
      ),

    medianReduction:
      median(
        reductionValues,
      ),

    averageReductionPercent:
      average(
        reductionPercentValues,
      ),

    medianReductionPercent:
      median(
        reductionPercentValues,
      ),

    largestReduction:
      max(
        reductionValues,
      ),

    largestReductionPercent:
      max(
        reductionPercentValues,
      ),

    topReductions:
      listingsWithKnownReduction
        .slice(
          0,
          10,
        ),

    areas,

    areasWithMostPriceDrops:
      [...areas]
        .sort(
          (a, b) =>
            b.uniqueListings -
            a.uniqueListings,
        )
        .slice(
          0,
          10,
        ),

    areasWithLargestMedianReduction:
      [...areas]
        .filter(
          (area) =>
            area.medianReduction !==
            null,
        )
        .sort(
          (a, b) =>
            (
              b.medianReduction ??
              0
            ) -
            (
              a.medianReduction ??
              0
            ),
        )
        .slice(
          0,
          10,
        ),
  };
}

function normalizeListing(
  listing: RawListing,
  snapshotDate: string,
): ListingObservation {
  const mlsNumber =
    firstString(
      listing.mlsNumber,
      listing.mls,
    );

  const address =
    firstString(
      listing.address,
      listing.fullAddress,
    );

  const area =
    cleanArea(
      firstString(
        listing.area,
        listing.city,
        listing.neighborhood,
      ),
    );

  const currentPrice =
    firstNumber(
      listing.currentPrice,
      listing.price,
    );

  const originalPrice =
    firstNumber(
      listing.originalPrice,
      listing.originalListPrice,
    );

  let totalPriceReduction =
    firstNumber(
      listing.totalPriceReduction,
      listing.priceReduction,
    );

  /*
   * If the parser did not explicitly provide
   * a reduction, calculate it from the prices.
   */
  if (
    (
      totalPriceReduction ===
        null ||
      totalPriceReduction <=
        0
    ) &&
    originalPrice !==
      null &&
    currentPrice !==
      null &&
    originalPrice >
      currentPrice
  ) {
    totalPriceReduction =
      originalPrice -
      currentPrice;
  }

  return {
    snapshotDate,

    mlsNumber,
    address,
    area,

    currentPrice,
    originalPrice,
    totalPriceReduction,
  };
}

function createListingKey(
  listing:
    ListingObservation,
): string | null {
  if (
    listing.mlsNumber
  ) {
    return (
      `mls:${listing.mlsNumber
        .toLowerCase()
        .trim()}`
    );
  }

  if (
    listing.address
  ) {
    return (
      `address:${normalizeText(
        listing.address,
      )}`
    );
  }

  return null;
}

function createMonthlyListing(
  key: string,
  records:
    ListingObservation[],
): MonthlyPriceDropListing {
  const sorted =
    [...records].sort(
      (a, b) =>
        a.snapshotDate.localeCompare(
          b.snapshotDate,
        ),
    );

  const first =
    sorted[0];

  const last =
    sorted[
      sorted.length - 1
    ];

  /*
   * Use the largest known cumulative
   * reduction seen during the month.
   *
   * This prevents counting the same
   * listing's cumulative reduction
   * multiple times across weekly reports.
   */
  const largestReduction =
    max(
      sorted
        .map(
          (record) =>
            record.totalPriceReduction,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !==
            null &&
            value >
            0,
        ),
    );

  const originalPrice =
    firstNonNullNumber(
      sorted.map(
        (record) =>
          record.originalPrice,
      ),
    );

  const currentPrice =
    lastNonNullNumber(
      sorted.map(
        (record) =>
          record.currentPrice,
      ),
    );

  const reductionPercent =
    calculateReductionPercent(
      largestReduction,
      originalPrice,
    );

  return {
    key,

    mlsNumber:
      firstNonNullString(
        sorted.map(
          (record) =>
            record.mlsNumber,
        ),
      ),

    address:
      firstNonNullString(
        sorted.map(
          (record) =>
            record.address,
        ),
      ),

    area:
      firstNonNullString(
        sorted.map(
          (record) =>
            record.area,
        ),
      ),

    currentPrice,

    originalPrice,

    totalPriceReduction:
      largestReduction,

    reductionPercent,

    firstSeenDate:
      first.snapshotDate,

    lastSeenDate:
      last.snapshotDate,

    appearances:
      sorted.length,
  };
}

function createAreaSummaries(
  listings:
    MonthlyPriceDropListing[],
): PriceDropAreaSummary[] {
  const grouped =
    new Map<
      string,
      MonthlyPriceDropListing[]
    >();

  for (
    const listing
    of listings
  ) {
    if (
      !listing.area ||
      /^unknown/i.test(
        listing.area,
      )
    ) {
      continue;
    }

    const key =
      listing.area;

    const existing =
      grouped.get(
        key,
      ) ?? [];

    existing.push(
      listing,
    );

    grouped.set(
      key,
      existing,
    );
  }

  return [
    ...grouped.entries(),
  ]
    .map(
      ([area, records]) => {
        const reductions =
          records
            .map(
              (listing) =>
                listing.totalPriceReduction,
            )
            .filter(
              (
                value,
              ): value is number =>
                value !==
                null &&
                value >
                0,
            );

        const percentages =
          records
            .map(
              (listing) =>
                listing.reductionPercent,
            )
            .filter(
              (
                value,
              ): value is number =>
                value !==
                null &&
                value >
                0,
            );

        return {
          area,

          uniqueListings:
            records.length,

          listingsWithKnownReduction:
            reductions.length,

          averageReduction:
            average(
              reductions,
            ),

          medianReduction:
            median(
              reductions,
            ),

          averageReductionPercent:
            average(
              percentages,
            ),

          medianReductionPercent:
            median(
              percentages,
            ),

          largestReduction:
            max(
              reductions,
            ),
        };
      },
    )
    .sort(
      (a, b) =>
        b.uniqueListings -
        a.uniqueListings,
    );
}

function calculateReductionPercent(
  reduction:
    number |
    null,

  originalPrice:
    number |
    null,
): number | null {
  if (
    reduction ===
      null ||
    originalPrice ===
      null ||
    originalPrice <=
      0
  ) {
    return null;
  }

  return round(
    (
      reduction /
      originalPrice
    ) * 100,
    2,
  );
}

function firstString(
  ...values:
    unknown[]
): string | null {
  for (
    const value
    of values
  ) {
    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function firstNumber(
  ...values:
    unknown[]
): number | null {
  for (
    const value
    of values
  ) {
    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value,
      )
    ) {
      return value;
    }

    if (
      typeof value ===
        "string"
    ) {
      const parsed =
        Number(
          value
            .replace(
              /\$/g,
              "",
            )
            .replace(
              /,/g,
              "",
            )
            .trim(),
        );

      if (
        Number.isFinite(
          parsed,
        )
      ) {
        return parsed;
      }
    }
  }

  return null;
}

function firstNonNullString(
  values:
    Array<
      string |
      null
    >,
): string | null {
  return (
    values.find(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    ) ??
    null
  );
}

function firstNonNullNumber(
  values:
    Array<
      number |
      null
    >,
): number | null {
  return (
    values.find(
      (
        value,
      ): value is number =>
        value !==
        null,
    ) ??
    null
  );
}

function lastNonNullNumber(
  values:
    Array<
      number |
      null
    >,
): number | null {
  for (
    let index =
      values.length - 1;
    index >=
    0;
    index--
  ) {
    if (
      values[index] !==
      null
    ) {
      return values[
        index
      ];
    }
  }

  return null;
}

function cleanArea(
  value:
    string |
    null,
): string | null {
  if (
    !value
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(
        /^com\s+/i,
        "",
      )
      .replace(
        /\s+Area$/i,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return (
    cleaned ||
    null
  );
}

function normalizeText(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function average(
  values:
    number[],
): number | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  const total =
    values.reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    );

  return round(
    total /
      values.length,
    2,
  );
}

function median(
  values:
    number[],
): number | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sorted =
    [...values].sort(
      (a, b) =>
        a -
        b,
    );

  const middle =
    Math.floor(
      sorted.length /
      2,
    );

  if (
    sorted.length %
      2 ===
    0
  ) {
    return round(
      (
        sorted[
          middle - 1
        ] +
        sorted[
          middle
        ]
      ) /
        2,
      2,
    );
  }

  return sorted[
    middle
  ];
}

function max(
  values:
    number[],
): number | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  return Math.max(
    ...values,
  );
}

function round(
  value: number,
  decimals: number,
): number {
  const multiplier =
    10 **
    decimals;

  return (
    Math.round(
      value *
        multiplier,
    ) /
    multiplier
  );
}

function isObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}