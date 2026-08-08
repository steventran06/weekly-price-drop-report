import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export interface MarketStats {
  page: number;

  area: string;
  areaNumber: number | null;

  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";

  reportDate: string | null;

  activeListings: number | null;
  pendingListings: number | null;
  pendingActiveRatio: number | null;
  monthsOfInventory: number | null;

  expiredListingsThreeMonths:
    number | null;

  closedListingsThreeMonths:
    number | null;

  averageOriginalListPrice:
    number | null;

  averageFinalListPrice:
    number | null;

  averageSalePrice:
    number | null;

  averageDaysOnMarketSold:
    number | null;

  averageDaysOnMarketActive:
    number | null;
}

export interface ExtractedMarketStats {
  sourcePdf: string;
  extractedAt: string;
  markets: MarketStats[];
}

export async function extractMarketStats(
  pdfPath: string,
): Promise<ExtractedMarketStats> {
  console.log("");
  console.log(
    "Extracting market stats from PDF...",
  );

  console.log(
    `PDF: ${pdfPath}`,
  );

  const pdfBuffer =
    await fs.readFile(
      pdfPath,
    );

  const pdf =
    await pdfjsLib.getDocument({
      data:
        new Uint8Array(
          pdfBuffer,
        ),
    }).promise;

  console.log(
    `PDF contains ${pdf.numPages} page(s).`,
  );

  const markets:
    MarketStats[] = [];

  for (
    let pageNumber = 1;
    pageNumber <=
    pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(
        pageNumber,
      );

    const textContent =
      await page.getTextContent();

    const pageText =
      textContent.items
        .map(
          (item) => {
            if (
              "str" in item &&
              typeof item.str ===
                "string"
            ) {
              return item.str;
            }

            return "";
          },
        )
        .filter(
          Boolean,
        )
        .join(
          " ",
        )
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    const market =
      parseMarketPage(
        pageText,
        pageNumber,
      );

    if (
      !market
    ) {
      console.warn(
        `Could not parse market totals on page ${pageNumber}.`,
      );

      continue;
    }

    markets.push(
      market,
    );

    console.log(
      `${pageNumber}. ${market.area} — ` +
        `${market.propertyType} — ` +
        `${market.monthsOfInventory ?? "N/A"} months inventory`,
    );
  }

  const result:
    ExtractedMarketStats = {
      sourcePdf:
        path.basename(
          pdfPath,
        ),

      extractedAt:
        new Date()
          .toISOString(),

      markets,
    };

  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      outputDirectory,
      "market-stats.json",
    );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      result,
      null,
      2,
    ),
    "utf8",
  );

  console.log("");

  console.log(
    `Extracted ${markets.length} market(s).`,
  );

  console.log(
    `Saved market stats to: ${outputPath}`,
  );

  return result;
}

function parseMarketPage(
  pageText: string,
  pageNumber: number,
): MarketStats | null {
  const heading =
    parsePageHeading(
      pageText,
    );

  const totals =
    parseMarketTotals(
      pageText,
    );

  if (
    !totals
  ) {
    return null;
  }

  return {
    page:
      pageNumber,

    area:
      normalizeAreaName(
        heading.area,
      ),

    areaNumber:
      heading.areaNumber,

    propertyType:
      heading.propertyType,

    reportDate:
      heading.reportDate,

    ...totals,
  };
}

function parsePageHeading(
  text: string,
): {
  area: string;

  areaNumber:
    number | null;

  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";

  reportDate:
    string | null;
} {
  let propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown" =
    "Unknown";

  if (
    /Single Family Residential/i.test(
      text,
    )
  ) {
    propertyType =
      "Single Family Residential";
  } else if (
    /Condominiums/i.test(
      text,
    )
  ) {
    propertyType =
      "Condominiums";
  }

  const reportDate =
    extractReportDate(
      text,
    );

  /*
   * Greater Portland aggregate.
   */
  if (
    /Greater Portland Areas\s+141-152,\s*155,\s*156,\s*170\+/i.test(
      text,
    )
  ) {
    return {
      area:
        "Greater Portland Areas",

      areaNumber:
        null,

      propertyType,

      reportDate,
    };
  }

  /*
   * Explicit fallbacks for headings
   * that pdf.js has previously mangled.
   *
   * These checks happen before the
   * generic area parser.
   */

  const knownAreas: Array<{
    pattern: RegExp;
    area: string;
  }> = [
    {
      pattern:
        /North Portland(?:\s+Area)?/i,

      area:
        "North Portland Area",
    },

    {
      pattern:
        /Northeast Portland(?:\s+Area)?/i,

      area:
        "Northeast Portland Area",
    },

    {
      pattern:
        /Southeast Portland(?:\s+Area)?/i,

      area:
        "Southeast Portland Area",
    },

    {
      pattern:
        /Gresham\/Troutdale(?:\s+Area)?/i,

      area:
        "Gresham/Troutdale Area",
    },

    {
      pattern:
        /Milwaukie\/Clackamas(?:\s+Area)?/i,

      area:
        "Milwaukie/Clackamas Area",
    },

    {
      pattern:
        /Oregon City\/Canby(?:\s+Area)?/i,

      area:
        "Oregon City/Canby Area",
    },

    {
      pattern:
        /Lake Oswego\/West Linn(?:\s+Area)?/i,

      area:
        "Lake Oswego/West Linn Area",
    },

    {
      pattern:
        /West Portland(?:\s+Area)?/i,

      area:
        "West Portland Area",
    },

    {
      pattern:
        /NW Portland(?:\s+Area)?/i,

      area:
        "NW Portland Area",
    },

    {
      pattern:
        /Beaverton(?:\s+Area)?/i,

      area:
        "Beaverton Area",
    },

    {
      pattern:
        /Tigard,\s*Tualatin,\s*Sherwood\s+and\s+(?:Wilsonville|Winsonville)(?:\s+Area)?/i,

      area:
        "Tigard, Tualatin, Sherwood and Wilsonville Area",
    },

    {
      pattern:
        /Hillsboro\/Forest Grove(?:\s+Area)?/i,

      area:
        "Hillsboro/Forest Grove Area",
    },

    {
      pattern:
        /Columbia County(?:\s+Area)?/i,

      area:
        "Columbia County Area",
    },

    {
      pattern:
        /Yamhill County(?:\s+Area)?/i,

      area:
        "Yamhill County Area",
    },

    {
      pattern:
        /Marion County(?:\s+Area)?/i,

      area:
        "Marion County Area",
    },
  ];

  for (
    const knownArea
    of knownAreas
  ) {
    if (
      knownArea.pattern.test(
        text,
      )
    ) {
      return {
        area:
          knownArea.area,

        areaNumber:
          extractAreaNumber(
            text,
            knownArea.pattern,
          ),

        propertyType,

        reportDate,
      };
    }
  }

  /*
   * Generic fallback.
   *
   * Handles normal headings such as:
   *
   * North Portland Area 141
   * Hillsboro/Forest Grove Area 152
   */
  const areaMatches = [
    ...text.matchAll(
      /([A-Za-z][A-Za-z\s,/&'-]{2,80}?\sArea)\s+(\d{3})/gi,
    ),
  ];

  if (
    areaMatches.length >
    0
  ) {
    const match =
      areaMatches[
        areaMatches.length -
          1
      ];

    const rawArea =
      match[1];

    const rawAreaNumber =
      match[2];

    return {
      area:
        normalizeAreaName(
          cleanAreaName(
            rawArea,
          ),
        ),

      areaNumber:
        rawAreaNumber
          ? Number(
              rawAreaNumber,
            )
          : null,

      propertyType,

      reportDate,
    };
  }

  return {
    area:
      "Unknown Area",

    areaNumber:
      null,

    propertyType,

    reportDate,
  };
}

function extractAreaNumber(
  text: string,
  areaPattern: RegExp,
): number | null {
  const pattern =
    new RegExp(
      `${areaPattern.source}\\s+(\\d{3})`,
      "i",
    );

  const match =
    text.match(
      pattern,
    );

  if (
    !match?.[1]
  ) {
    return null;
  }

  const value =
    Number(
      match[1],
    );

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function extractReportDate(
  text: string,
): string | null {
  const dateMatch =
    text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i,
    );

  return (
    dateMatch?.[0] ??
    null
  );
}

function parseMarketTotals(
  text: string,
): Omit<
  MarketStats,
  | "page"
  | "area"
  | "areaNumber"
  | "propertyType"
  | "reportDate"
> | null {
  const marketTotalsIndex =
    text.search(
      /Market\s+Totals/i,
    );

  if (
    marketTotalsIndex ===
    -1
  ) {
    return null;
  }

  const totalsText =
    text
      .slice(
        marketTotalsIndex,
        marketTotalsIndex +
          700,
      )
      .replace(
        /Market\s+Totals/i,
        "",
      )
      .trim();

  /*
   * TMO currently includes a
   * sale-to-list percentage in the
   * source row.
   *
   * We still consume that token so
   * every field after it stays aligned,
   * but we intentionally do not store it.
   */
  const tokens =
    totalsText.match(
      /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|N\/A|\d{1,3}(?:,\d{3})*(?:\.\d+)?%|\d{1,3}(?:,\d{3})*(?:\.\d+)?/gi,
    ) ?? [];

  if (
    tokens.length <
    12
  ) {
    console.warn(
      "Market Totals row did not contain enough values:",
      tokens,
    );

    return null;
  }

  const values =
    tokens.slice(
      0,
      12,
    );

  return {
    activeListings:
      parseNumber(
        values[0],
      ),

    pendingListings:
      parseNumber(
        values[1],
      ),

    pendingActiveRatio:
      parsePercentage(
        values[2],
      ),

    monthsOfInventory:
      parseNumber(
        values[3],
      ),

    expiredListingsThreeMonths:
      parseNumber(
        values[4],
      ),

    closedListingsThreeMonths:
      parseNumber(
        values[5],
      ),

    averageOriginalListPrice:
      parseCurrency(
        values[6],
      ),

    averageFinalListPrice:
      parseCurrency(
        values[7],
      ),

    averageSalePrice:
      parseCurrency(
        values[8],
      ),

    /*
     * values[9] is the TMO
     * sale-to-list percentage.
     *
     * Intentionally ignored.
     */

    averageDaysOnMarketSold:
      parseNumber(
        values[10],
      ),

    averageDaysOnMarketActive:
      parseNumber(
        values[11],
      ),
  };
}

function parseNumber(
  value:
    string |
    undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value,
    )
  ) {
    return null;
  }

  const parsed =
    Number(
      value.replace(
        /,/g,
        "",
      ),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function parseCurrency(
  value:
    string |
    undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value,
    )
  ) {
    return null;
  }

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

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function parsePercentage(
  value:
    string |
    undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value,
    )
  ) {
    return null;
  }

  const parsed =
    Number(
      value
        .replace(
          "%",
          "",
        )
        .replace(
          /,/g,
          "",
        ),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function cleanAreaName(
  value: string,
): string {
  return value
    .replace(
      /^.*?TMOReport\.com\s*/i,
      "",
    )
    .replace(
      /^com\s+/i,
      "",
    )
    .replace(
      /^Copyright.*?\s(?=[A-Z])/i,
      "",
    )
    .replace(
      /^for the period.*?\s(?=[A-Z])/i,
      "",
    )
    .replace(
      /^Based on information.*?\s(?=[A-Z])/i,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeAreaName(
  value: string,
): string {
  const cleaned =
    cleanAreaName(
      value,
    );

  const normalized =
    cleaned
      .replace(
        /^com\s+/i,
        "",
      )
      .replace(
        /\bWinsonville\b/gi,
        "Wilsonville",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    /Marion County/i.test(
      normalized,
    )
  ) {
    return "Marion County Area";
  }

  if (
    /Yamhill County/i.test(
      normalized,
    )
  ) {
    return "Yamhill County Area";
  }

  if (
    /Columbia County/i.test(
      normalized,
    )
  ) {
    return "Columbia County Area";
  }

  if (
    /Tigard.*Tualatin.*Sherwood.*Wilsonville/i.test(
      normalized,
    )
  ) {
    return "Tigard, Tualatin, Sherwood and Wilsonville Area";
  }

  return (
    normalized ||
    "Unknown Area"
  );
}
