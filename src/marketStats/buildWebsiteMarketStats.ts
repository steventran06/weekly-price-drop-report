import type {
  ExtractedMarketStats,
  MarketStats,
  MarketStatsRegion,
} from "./extractMarketStats.js";

export interface WebsiteMarketStats {
  source: "TMO";
  reportDate: string;
  generatedAt: string;

  /*
   * Keep per-region dates so the website can show
   * the correct freshness independently for OR/WA.
   * Optional for backwards compatibility with older
   * latest.json files already in the website repo.
   */
  regionReportDates?: {
    oregon?: string;
    washington?: string;
  };

  markets: MarketStats[];
}

const MAX_PAGE_DATE_DRIFT_DAYS =
  14;

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

  /*
   * Each regional TMO PDF represents one reporting period.
   *
   * The PDF text can contain other long-form dates, so a page-by-page
   * date extraction can accidentally pick up an unrelated older date.
   * Instead, determine one canonical page date for Oregon and one for
   * Washington, then assign that date to every market row from that
   * region before publishing the website JSON.
   */
  const normalizedMarkets =
    normalizeRegionalReportDates(
      stats.markets,
      filenames,
    );

  const reportDate =
    extractBestReportDate(
      filenames,
      normalizedMarkets,
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
    `Markets included: ${normalizedMarkets.length}`,
  );

  const regionCounts =
    countRegions(
      normalizedMarkets,
    );

  console.log(
    `Oregon markets: ${regionCounts.oregon}`,
  );
  console.log(
    `Washington markets: ${regionCounts.washington}`,
  );

  const regionReportDates = {
    oregon:
      getRegionReportDate(
        normalizedMarkets,
        "oregon",
      ) ??
      undefined,

    washington:
      getRegionReportDate(
        normalizedMarkets,
        "washington",
      ) ??
      undefined,
  };

  return {
    source:
      "TMO",

    reportDate,

    generatedAt:
      new Date()
        .toISOString(),

    regionReportDates,

    markets:
      normalizedMarkets,
  };
}

function normalizeRegionalReportDates(
  markets: MarketStats[],
  filenames: string[],
): MarketStats[] {
  let normalized =
    [...markets];

  for (
    const region
    of [
      "oregon",
      "washington",
    ] as const
  ) {
    normalized =
      normalizeRegionReportDates(
        normalized,
        filenames,
        region,
      );
  }

  return normalized;
}

function normalizeRegionReportDates(
  markets: MarketStats[],
  filenames: string[],
  region: MarketStatsRegion,
): MarketStats[] {
  const regionMarkets =
    markets.filter(
      (market) =>
        market.sourceRegion ===
        region,
    );

  if (
    regionMarkets.length ===
    0
  ) {
    return markets;
  }

  const regionFilename =
    findRegionFilename(
      filenames,
      region,
    );

  if (!regionFilename) {
    throw new Error(
      `Could not identify the ${region} TMO attachment filename. ` +
        `Available attachment(s): ${filenames.join(", ")}`,
    );
  }

  const pageDates =
    regionMarkets
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

  const attachmentDate =
    extractReportDateFromFilename(
      regionFilename,
      pageDates,
    );

  if (!attachmentDate) {
    throw new Error(
      `Could not determine the ${region} attachment date from ${regionFilename}.`,
    );
  }

  const canonicalPageDate =
    findCanonicalPageDate(
      pageDates,
      attachmentDate,
    );

  if (!canonicalPageDate) {
    throw new Error(
      `Could not determine a canonical ${region} page report date from ${regionFilename}.`,
    );
  }

  const canonicalLongDate =
    formatLongDate(
      canonicalPageDate,
    );

  console.log("");
  console.log(
    `Normalizing ${capitalize(region)} market report dates...`,
  );
  console.log(
    `${capitalize(region)} attachment: ${regionFilename}`,
  );
  console.log(
    `${capitalize(region)} attachment week date: ${formatIsoDate(attachmentDate)}`,
  );
  console.log(
    `${capitalize(region)} canonical page date: ${canonicalLongDate}`,
  );

  let correctedCount =
    0;

  const normalized =
    markets.map(
      (market) => {
        if (
          market.sourceRegion !==
          region
        ) {
          return market;
        }

        if (
          market.reportDate ===
          canonicalLongDate
        ) {
          return market;
        }

        correctedCount++;

        console.warn(
          `Correcting ${capitalize(region)} report date for ${market.area} ` +
            `(${market.propertyType}) from ` +
            `${market.reportDate ?? "missing"} to ${canonicalLongDate}.`,
        );

        return {
          ...market,
          reportDate:
            canonicalLongDate,
        };
      },
    );

  console.log(
    correctedCount > 0
      ? `Corrected ${correctedCount} ${region} market report date(s) before website publish.`
      : `${capitalize(region)} market report dates are already consistent.`,
  );

  return normalized;
}

function findRegionFilename(
  filenames: string[],
  region: MarketStatsRegion,
): string | null {
  if (
    region ===
    "washington"
  ) {
    const explicitWashington =
      filenames.find(
        (filename) =>
          /washington/i.test(
            filename,
          ),
      );

    if (explicitWashington) {
      return explicitWashington;
    }

    const yearless =
      filenames.find(
        (filename) =>
          /(?:^|[^0-9])\d{1,2}[.\-_]\d{1,2}\.pdf$/i.test(
            filename,
          ) &&
          !/\d{1,2}[.\-_/]\d{1,2}[.\-_/]\d{2,4}(?=\.pdf\b)/i.test(
            filename,
          ),
      );

    return (
      yearless ??
      null
    );
  }

  const explicitOregon =
    filenames.find(
      (filename) =>
        /oregon/i.test(
          filename,
        ),
    );

  if (explicitOregon) {
    return explicitOregon;
  }

  const fullDateFilename =
    filenames.find(
      (filename) =>
        /\d{1,2}[.\-_/]\d{1,2}[.\-_/]\d{2,4}(?=\.pdf\b|\D|$)/i.test(
          filename,
        ) &&
        !/washington/i.test(
          filename,
        ),
    );

  if (fullDateFilename) {
    return fullDateFilename;
  }

  const nonWashington =
    filenames.find(
      (filename) =>
        !/washington/i.test(
          filename,
        ),
    );

  return (
    nonWashington ??
    null
  );
}

function findCanonicalPageDate(
  pageDates: Date[],
  attachmentDate: Date,
): Date | null {
  const nearby =
    pageDates.filter(
      (date) =>
        dateDistanceDays(
          date,
          attachmentDate,
        ) <=
        MAX_PAGE_DATE_DRIFT_DAYS,
    );

  if (
    nearby.length > 0
  ) {
    return chooseMostCommonDate(
      nearby,
      attachmentDate,
    );
  }

  /*
   * TMO attachments are commonly named for the Monday "week of"
   * date while the report page itself is dated the preceding
   * Sunday. If no extracted page date is plausibly close to the
   * attachment date, use Sunday as the fallback for a Monday
   * attachment.
   */
  if (
    attachmentDate.getUTCDay() ===
    1
  ) {
    return new Date(
      attachmentDate.getTime() -
        24 * 60 * 60 * 1000,
    );
  }

  return attachmentDate;
}

function chooseMostCommonDate(
  dates: Date[],
  referenceDate: Date,
): Date | null {
  if (
    dates.length ===
    0
  ) {
    return null;
  }

  const counts =
    new Map<
      string,
      {
        date: Date;
        count: number;
      }
    >();

  for (const date of dates) {
    const key =
      formatIsoDate(
        date,
      );

    const existing =
      counts.get(
        key,
      );

    if (existing) {
      existing.count++;
      continue;
    }

    counts.set(
      key,
      {
        date,
        count: 1,
      },
    );
  }

  const ranked =
    [...counts.values()]
      .sort(
        (a, b) => {
          if (
            b.count !==
            a.count
          ) {
            return (
              b.count -
              a.count
            );
          }

          return (
            dateDistanceDays(
              a.date,
              referenceDate,
            ) -
            dateDistanceDays(
              b.date,
              referenceDate,
            )
          );
        },
      );

  return (
    ranked[0]?.date ??
    null
  );
}

function dateDistanceDays(
  a: Date,
  b: Date,
): number {
  return (
    Math.abs(
      a.getTime() -
        b.getTime(),
    ) /
    (24 * 60 * 60 * 1000)
  );
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
   * Washington example:
   * Washington-TMO-Reports-8.3.pdf
   *
   * The filename omits the year, so infer the
   * closest year from dates found in the PDF.
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

function formatLongDate(
  date: Date,
): string {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    `${monthNames[date.getUTCMonth()]} ` +
    `${date.getUTCDate()}, ` +
    `${date.getUTCFullYear()}`
  );
}

function capitalize(
  value: string,
): string {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function getRegionReportDate(
  markets: MarketStats[],
  region: MarketStatsRegion,
): string | null {
  const dates =
    markets
      .filter(
        (market) =>
          market.sourceRegion ===
          region,
      )
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
      )
      .sort(
        (a, b) =>
          b.getTime() -
          a.getTime(),
      );

  return dates[0]
    ? formatIsoDate(
        dates[0],
      )
    : null;
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
