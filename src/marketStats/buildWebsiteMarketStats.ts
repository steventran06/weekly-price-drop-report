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
  attachmentFilename: string,
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


  /*
   * The TMO attachment filename is the
   * authoritative weekly report date.
   *
   * Example:
   *
   * TMO-Reports-Week-of-8.3.26.pdf
   *                  ↓
   *              2026-08-03
   *
   * We intentionally do NOT use individual
   * page-level reportDate values here because
   * PDF extraction can pick up unrelated dates
   * from individual pages.
   */
  const reportDate =
    extractReportDateFromFilename(
      attachmentFilename,
    );


  if (
    !reportDate
  ) {
    throw new Error(
      "Could not determine the TMO report date from attachment filename: " +
        attachmentFilename,
    );
  }


  console.log("");

  console.log(
    "Preparing website market stats...",
  );

  console.log(
    `TMO attachment: ${attachmentFilename}`,
  );

  console.log(
    `TMO report date: ${reportDate}`,
  );

  console.log(
    `Markets included: ${stats.markets.length}`,
  );


  return {
    source:
      "TMO",

    reportDate,

    generatedAt:
      new Date()
        .toISOString(),

    /*
     * IMPORTANT:
     *
     * These are ONLY the markets extracted
     * from the single PDF processed during
     * this market-stats run.
     *
     * No historical reports are merged.
     */
    markets:
      stats.markets,
  };
}


function extractReportDateFromFilename(
  filename: string,
): string | null {
  /*
   * Expected examples:
   *
   * TMO-Reports-Week-of-8.3.26.pdf
   * TMO-Reports-Week-of-08.03.26.pdf
   * TMO Reports Week of 8.3.26.pdf
   *
   * Also tolerates -, _, or / separators.
   */
  const match =
    filename.match(
      /week[\s_-]*of[\s_-]*(\d{1,2})[.\-_/](\d{1,2})[.\-_/](\d{2,4})/i,
    );


  if (
    !match
  ) {
    return null;
  }


  const month =
    Number(
      match[1],
    );


  const day =
    Number(
      match[2],
    );


  let year =
    Number(
      match[3],
    );


  if (
    year < 100
  ) {
    year += 2000;
  }


  if (
    !isValidDate(
      year,
      month,
      day,
    )
  ) {
    return null;
  }


  return (
    `${String(year).padStart(
      4,
      "0",
    )}-` +
    `${String(month).padStart(
      2,
      "0",
    )}-` +
    `${String(day).padStart(
      2,
      "0",
    )}`
  );
}


function isValidDate(
  year: number,
  month: number,
  day: number,
): boolean {
  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );


  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
  );
}