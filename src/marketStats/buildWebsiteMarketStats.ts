import type {
  ExtractedMarketStats,
  MarketStats,
} from "./extractMarketStats.js";

export interface WebsiteMarketStats {
  source: "TMO";
  reportDate: string;
  generatedAt: string;
  markets: MarketStats[];
}

export function buildWebsiteMarketStats(
  stats: ExtractedMarketStats,
  attachmentFilenames:
    | string
    | string[],
): WebsiteMarketStats {
  if (
    !Array.isArray(
      stats.markets,
    ) ||
    stats.markets.length === 0
  ) {
    throw new Error(
      "Cannot build website market stats because no markets were extracted.",
    );
  }

  const unknownMarkets =
    stats.markets.filter(
      (market) =>
        market.area ===
        "Unknown Area",
    );

  if (
    unknownMarkets.length >
    0
  ) {
    throw new Error(
      "Refusing to publish website market stats because " +
        `${unknownMarkets.length} page(s) still have an Unknown Area heading.`,
    );
  }

  const filenames =
    Array.isArray(
      attachmentFilenames,
    )
      ? attachmentFilenames
      : [attachmentFilenames];

  const reportDate =
    extractBestReportDate(
      filenames,
      stats.markets,
    );

  if (!reportDate) {
    throw new Error(
      "Could not determine the TMO report date from the attachment filename(s) or page report dates: " +
        filenames.join(", "),
    );
  }

  console.log("");
  console.log(
    "Preparing website market stats...",
  );
  console.log(
    `TMO attachment(s): ${filenames.join(", ")}`,
  );
  console.log(
    `TMO report date: ${reportDate}`,
  );
  console.log(
    `Markets included: ${stats.markets.length}`,
  );

  const regionCounts =
    countRegions(
      stats.markets,
    );

  console.log(
    `Oregon markets: ${regionCounts.oregon}`,
  );
  console.log(
    `Washington markets: ${regionCounts.washington}`,
  );

  return {
    source:
      "TMO",

    reportDate,

    generatedAt:
      new Date()
        .toISOString(),

    markets:
      stats.markets,
  };
}

function extractBestReportDate(
  filenames: string[],
  markets: MarketStats[],
): string | null {
  const pageDates =
    markets
      .map(
        (market) =>
          parseLongDate(
            market.reportDate,
          ),
      )
      .filter(
        (
          value,
        ): value is Date =>
          value !== null,
      );

  const filenameDates: Date[] = [];

  for (const filename of filenames) {
    const parsed =
      extractReportDateFromFilename(
        filename,
        pageDates,
      );

    if (parsed) {
      filenameDates.push(
        parsed,
      );
    }
  }

  const candidates =
    filenameDates.length > 0
      ? filenameDates
      : pageDates;

  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  const latest =
    [...candidates].sort(
      (a, b) =>
        b.getTime() -
        a.getTime(),
    )[0];

  return formatIsoDate(
    latest,
  );
}

function extractReportDateFromFilename(
  filename: string,
  pageDates: Date[],
): Date | null {
  /*
   * Oregon example:
   * TMO-Reports-Week-of-8.3.26.pdf
   */
  const fullDateMatch =
    filename.match(
      /(\d{1,2})[.\-_/](\d{1,2})[.\-_/](\d{2,4})(?=\.pdf\b|\D|$)/i,
    );

  if (fullDateMatch) {
    const month =
      Number(
        fullDateMatch[1],
      );

    const day =
      Number(
        fullDateMatch[2],
      );

    let year =
      Number(
        fullDateMatch[3],
      );

    if (year < 100) {
      year += 2000;
    }

    return makeUtcDate(
      year,
      month,
      day,
    );
  }

  /*
   * Washington currently arrives as:
   * Washington-TMO-Reports-8.3.pdf
   *
   * The filename omits the year, so infer the
   * year from the full date printed on the TMO
   * pages. The filename's 8.3 remains the weekly
   * report date, while the page may say Aug 2.
   */
  const monthDayMatch =
    filename.match(
      /(\d{1,2})[.\-_](\d{1,2})(?=\.pdf\b)/i,
    );

  if (
    !monthDayMatch ||
    pageDates.length === 0
  ) {
    return null;
  }

  const month =
    Number(
      monthDayMatch[1],
    );

  const day =
    Number(
      monthDayMatch[2],
    );

  return inferClosestYear(
    month,
    day,
    pageDates,
  );
}

function inferClosestYear(
  month: number,
  day: number,
  referenceDates: Date[],
): Date | null {
  if (
    referenceDates.length ===
    0
  ) {
    return null;
  }

  let bestDate:
    Date | null = null;

  let bestDistance =
    Number.POSITIVE_INFINITY;

  for (const referenceDate of referenceDates) {
    const referenceYear =
      referenceDate.getUTCFullYear();

    for (
      const year
      of [
        referenceYear - 1,
        referenceYear,
        referenceYear + 1,
      ]
    ) {
      const candidate =
        makeUtcDate(
          year,
          month,
          day,
        );

      if (!candidate) {
        continue;
      }

      const distance =
        Math.abs(
          candidate.getTime() -
          referenceDate.getTime(),
        );

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        bestDate =
          candidate;
      }
    }
  }

  return bestDate;
}

function parseLongDate(
  value: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i,
    );

  if (!match) {
    return null;
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const month =
    monthNames.indexOf(
      match[1].toLowerCase(),
    ) + 1;

  return makeUtcDate(
    Number(
      match[3],
    ),
    month,
    Number(
      match[2],
    ),
  );
}

function makeUtcDate(
  year: number,
  month: number,
  day: number,
): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return date;
}

function formatIsoDate(
  date: Date,
): string {
  return (
    `${date.getUTCFullYear()}-` +
    `${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}-` +
    `${String(
      date.getUTCDate(),
    ).padStart(2, "0")}`
  );
}

function countRegions(
  markets: MarketStats[],
): {
  oregon: number;
  washington: number;
} {
  let oregon = 0;
  let washington = 0;

  for (const market of markets) {
    if (
      market.sourceRegion ===
      "oregon"
    ) {
      oregon++;
    }

    if (
      market.sourceRegion ===
      "washington"
    ) {
      washington++;
    }
  }

  return {
    oregon,
    washington,
  };
}
