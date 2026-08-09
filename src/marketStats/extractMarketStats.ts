import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type MarketStatsRegion =
  | "oregon"
  | "washington";

export interface MarketStats {
  page: number;

  area: string;
  areaNumber: number | null;

  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";

  reportDate: string | null;

  sourceRegion:
    | MarketStatsRegion
    | null;

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

export interface ExtractMarketStatsOptions {
  region?: MarketStatsRegion;
  outputFilename?: string;
}

interface ParsedHeading {
  area: string;
  areaNumber: number | null;
  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";
  reportDate: string | null;
  sourceRegion:
    | MarketStatsRegion
    | null;
}

export async function extractMarketStats(
  pdfPath: string,
  options: ExtractMarketStatsOptions = {},
): Promise<ExtractedMarketStats> {
  console.log("");
  console.log(
    "Extracting market stats from PDF...",
  );
  console.log(
    `PDF: ${pdfPath}`,
  );

  if (options.region) {
    console.log(
      `Region: ${options.region}`,
    );
  }

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
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    const market =
      parseMarketPage(
        pageText,
        pageNumber,
        options.region ?? null,
      );

    if (!market) {
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

  const outputFilename =
    sanitizeOutputFilename(
      options.outputFilename ??
        "market-stats.json",
    );

  const outputPath =
    path.join(
      outputDirectory,
      outputFilename,
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
  regionHint:
    | MarketStatsRegion
    | null,
): MarketStats | null {
  const heading =
    parsePageHeading(
      pageText,
      regionHint,
    );

  const totals =
    parseMarketTotals(
      pageText,
    );

  if (!totals) {
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

    sourceRegion:
      heading.sourceRegion,

    ...totals,
  };
}

function parsePageHeading(
  text: string,
  regionHint:
    | MarketStatsRegion
    | null,
): ParsedHeading {
  const propertyType =
    extractPropertyType(
      text,
    );

  const reportDate =
    extractReportDate(
      text,
    );

  if (
    regionHint ===
    "washington"
  ) {
    return (
      parseWashingtonHeading(
        text,
        propertyType,
        reportDate,
      ) ??
      parseOregonHeading(
        text,
        propertyType,
        reportDate,
      ) ??
      unknownHeading(
        propertyType,
        reportDate,
        regionHint,
      )
    );
  }

  if (
    regionHint ===
    "oregon"
  ) {
    return (
      parseOregonHeading(
        text,
        propertyType,
        reportDate,
      ) ??
      parseWashingtonHeading(
        text,
        propertyType,
        reportDate,
      ) ??
      unknownHeading(
        propertyType,
        reportDate,
        regionHint,
      )
    );
  }

  return (
    parseOregonHeading(
      text,
      propertyType,
      reportDate,
    ) ??
    parseWashingtonHeading(
      text,
      propertyType,
      reportDate,
    ) ??
    unknownHeading(
      propertyType,
      reportDate,
      null,
    )
  );
}

function parseWashingtonHeading(
  text: string,
  propertyType:
    ParsedHeading["propertyType"],
  reportDate: string | null,
): ParsedHeading | null {
  const clarkCounty =
    text.match(
      /\bClark County(?:\s+Area\s+([0-9]+(?:\s*-\s*[0-9]+)?))?/i,
    );

  if (clarkCounty) {
    const areaCode =
      normalizeAreaCode(
        clarkCounty[1],
      );

    return {
      area:
        areaCode
          ? `Clark County Area ${areaCode}`
          : "Clark County",

      areaNumber:
        null,

      propertyType,
      reportDate,
      sourceRegion:
        "washington",
    };
  }

  if (
    /\b(?:NWMLS[-\s]*)?Cowlitz County\b/i.test(
      text,
    )
  ) {
    return {
      area:
        "Cowlitz County",

      areaNumber:
        null,

      propertyType,
      reportDate,
      sourceRegion:
        "washington",
    };
  }

  const groupedVancouver =
    text.match(
      /\bVancouver\s+Areas?-?\s*([0-9]+(?:\s*,\s*[0-9]+)+)\s+Group-?\s*(\d+)\b/i,
    );

  if (groupedVancouver) {
    const areaCodes =
      groupedVancouver[1]
        .split(",")
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean)
        .join(",");

    const groupNumber =
      Number(
        groupedVancouver[2],
      );

    return {
      area:
        `Vancouver Areas ${areaCodes} ` +
        `(Group ${groupNumber})`,

      areaNumber:
        null,

      propertyType,
      reportDate,
      sourceRegion:
        "washington",
    };
  }

  const singleVancouver =
    text.match(
      /\bVancouver\s+Area\s+(\d{1,3})(?:\s+Area\s+\1)?\b/i,
    );

  if (singleVancouver) {
    const areaNumber =
      Number(
        singleVancouver[1],
      );

    return {
      area:
        `Vancouver Area ${areaNumber}`,

      areaNumber:
        Number.isFinite(
          areaNumber,
        )
          ? areaNumber
          : null,

      propertyType,
      reportDate,
      sourceRegion:
        "washington",
    };
  }

  const propertiesOverOneMillion =
    text.match(
      /\bProperties\s+Over\s+\$?\s*1M(?:\s+Areas?\s+([0-9]+(?:\s*-\s*[0-9]+)?))?/i,
    );

  if (propertiesOverOneMillion) {
    const areaCode =
      normalizeAreaCode(
        propertiesOverOneMillion[1],
      );

    return {
      area:
        areaCode
          ? `Properties Over $1M Areas ${areaCode}`
          : "Properties Over $1M",

      areaNumber:
        null,

      propertyType,
      reportDate,
      sourceRegion:
        "washington",
    };
  }

  return null;
}

function parseOregonHeading(
  text: string,
  propertyType:
    ParsedHeading["propertyType"],
  reportDate: string | null,
): ParsedHeading | null {
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
      sourceRegion:
        "oregon",
    };
  }

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
      !knownArea.pattern.test(
        text,
      )
    ) {
      continue;
    }

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
      sourceRegion:
        "oregon",
    };
  }

  const areaMatches = [
    ...text.matchAll(
      /([A-Za-z][A-Za-z\s,/&'-]{2,80}?\sArea)\s+(\d{3})/gi,
    ),
  ];

  if (
    areaMatches.length ===
    0
  ) {
    return null;
  }

  const match =
    areaMatches[
      areaMatches.length - 1
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
    sourceRegion:
      "oregon",
  };
}

function unknownHeading(
  propertyType:
    ParsedHeading["propertyType"],
  reportDate: string | null,
  sourceRegion:
    | MarketStatsRegion
    | null,
): ParsedHeading {
  return {
    area:
      "Unknown Area",

    areaNumber:
      null,

    propertyType,
    reportDate,
    sourceRegion,
  };
}

function extractPropertyType(
  text: string,
): ParsedHeading["propertyType"] {
  if (
    /Single Family Residential/i.test(
      text,
    )
  ) {
    return "Single Family Residential";
  }

  if (
    /Condominiums/i.test(
      text,
    )
  ) {
    return "Condominiums";
  }

  return "Unknown";
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

  if (!match?.[1]) {
    return null;
  }

  const value =
    Number(
      match[1],
    );

  return Number.isFinite(value)
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
  | "sourceRegion"
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
   * TMO includes a list-to-sale percentage
   * between average sale price and DOM.
   * We consume that value to preserve column
   * alignment, but do not store it.
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
    | string
    | undefined,
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

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseCurrency(
  value:
    | string
    | undefined,
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
        .replace(/\$/g, "")
        .replace(/,/g, "")
        .trim(),
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parsePercentage(
  value:
    | string
    | undefined,
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
        .replace("%", "")
        .replace(/,/g, ""),
    );

  return Number.isFinite(parsed)
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
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAreaName(
  value: string,
): string {
  const normalized =
    cleanAreaName(
      value,
    )
      .replace(
        /^com\s+/i,
        "",
      )
      .replace(
        /\bWinsonville\b/gi,
        "Wilsonville",
      )
      .replace(/\s+/g, " ")
      .trim();

  if (
    /Marion County/i.test(
      normalized,
    ) &&
    !/Cowlitz/i.test(
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

function normalizeAreaCode(
  value:
    | string
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .replace(/\s+/g, "")
      .trim();

  return normalized || null;
}

function sanitizeOutputFilename(
  value: string,
): string {
  const filename =
    path.basename(
      value,
    )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      );

  return filename
    .toLowerCase()
    .endsWith(".json")
    ? filename
    : `${filename}.json`;
}