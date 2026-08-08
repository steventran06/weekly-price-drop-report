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
  expiredListingsThreeMonths: number | null;
  closedListingsThreeMonths: number | null;

  averageOriginalListPrice: number | null;
  averageFinalListPrice: number | null;
  averageSalePrice: number | null;

  /*
   * We are intentionally not using this metric.
   * Keeping it here as null maintains compatibility
   * with the existing analysis types.
   */
  listToSalesRatio: number | null;

  averageDaysOnMarketSold: number | null;
  averageDaysOnMarketActive: number | null;
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
  console.log("Extracting market stats from PDF...");
  console.log(`PDF: ${pdfPath}`);

  const pdfBuffer =
    await fs.readFile(pdfPath);

  const pdf =
    await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
    }).promise;

  console.log(
    `PDF contains ${pdf.numPages} page(s).`,
  );

  const markets: MarketStats[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(pageNumber);

    const textContent =
      await page.getTextContent();

    const pageText = textContent.items
      .map((item) => {
        if (
          "str" in item &&
          typeof item.str === "string"
        ) {
          return item.str;
        }

        return "";
      })
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const market =
      parseMarketPage(
        pageText,
        pageNumber,
      );

    if (!market) {
      console.warn(
        `Could not parse market totals on page ${pageNumber}.`,
      );

      continue;
    }

    markets.push(market);

    console.log(
      `${pageNumber}. ${market.area} — ` +
        `${market.propertyType} — ` +
        `${market.monthsOfInventory ?? "N/A"} months inventory`,
    );
  }

  const result: ExtractedMarketStats = {
    sourcePdf:
      path.basename(pdfPath),

    extractedAt:
      new Date().toISOString(),

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
    parsePageHeading(pageText);

  const totals =
    parseMarketTotals(pageText);

  if (!totals) {
    return null;
  }

  return {
    page: pageNumber,
    area: heading.area,
    areaNumber: heading.areaNumber,
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
  areaNumber: number | null;
  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";
  reportDate: string | null;
} {
  let propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown" =
      "Unknown";

  if (
    /\(Single Family Residential\)/i.test(
      text,
    )
  ) {
    propertyType =
      "Single Family Residential";
  } else if (
    /\(Condominiums\)/i.test(text)
  ) {
    propertyType =
      "Condominiums";
  }

  let area =
    "Unknown Area";

  let areaNumber:
    number | null = null;

  /*
   * Greater Portland aggregate pages.
   */
  const greaterPortlandMatch =
    text.match(
      /Greater Portland Areas\s+141-152,\s*155,\s*156,\s*170\+/i,
    );

  if (greaterPortlandMatch) {
    return {
      area:
        "Greater Portland Areas",
      areaNumber: null,
      propertyType,
      reportDate:
        extractReportDate(text),
    };
  }

  /*
   * Standard numbered market areas.
   */
  const areaMatches = [
    ...text.matchAll(
      /([A-Za-z][A-Za-z\s,/&'-]{2,100}?\sArea)\s+(\d{3})/gi,
    ),
  ];

  if (areaMatches.length > 0) {
    const match =
      areaMatches[
        areaMatches.length - 1
      ];

    area =
      cleanAreaName(
        match[1],
      );

    areaNumber =
      Number(match[2]);
  }

  /*
   * County pages do not always have an
   * "Area ###" heading.
   */
  if (area === "Unknown Area") {
    const countyMatch =
      text.match(
        /\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+County\b/i,
      );

    if (countyMatch) {
      area =
        `${countyMatch[1].trim()} County`;
    }
  }

  return {
    area,
    areaNumber,
    propertyType,
    reportDate:
      extractReportDate(text),
  };
}

function extractReportDate(
  text: string,
): string | null {
  const dateMatch =
    text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i,
    );

  return dateMatch?.[0] ?? null;
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
    marketTotalsIndex === -1
  ) {
    return null;
  }

  const totalsText =
    text
      .slice(
        marketTotalsIndex,
        marketTotalsIndex + 700,
      )
      .replace(
        /Market\s+Totals/i,
        "",
      )
      .trim();

  /*
   * Pull all numeric/currency/percentage/N/A
   * values from the Market Totals row.
   */
  const tokens =
    totalsText.match(
      /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|N\/A|\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%|\d{1,3}(?:,\d{3})*(?:\.\d+)?/gi,
    ) ?? [];

  if (
    tokens.length < 12
  ) {
    console.warn(
      "Market Totals row did not contain enough values:",
      tokens,
    );

    return null;
  }

  /*
   * Expected order:
   *
   * 0  Active listings
   * 1  Pending listings
   * 2  Pending/active ratio
   * 3  Months inventory
   * 4  Expired listings
   * 5  Closed listings
   * 6  Average original list price
   * 7  Average final list price
   * 8  Average sale price
   * 9  Sale/list ratio - intentionally ignored
   * 10 Average DOM sold
   * 11 Average DOM active
   */
  const values =
    tokens.slice(0, 12);

  return {
    activeListings:
      parseNumber(values[0]),

    pendingListings:
      parseNumber(values[1]),

    pendingActiveRatio:
      parsePercentage(
        values[2],
      ),

    monthsOfInventory:
      parseNumber(values[3]),

    expiredListingsThreeMonths:
      parseNumber(values[4]),

    closedListingsThreeMonths:
      parseNumber(values[5]),

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
     * We aren't using sale-to-list.
     */
    listToSalesRatio: null,

    /*
     * Still skip over values[9], because that position
     * belongs to the sale-to-list ratio in the PDF.
     */
    averageDaysOnMarketSold:
      parseNumber(values[10]),

    averageDaysOnMarketActive:
      parseNumber(values[11]),
  };
}

function parseNumber(
  value: string | undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value.trim(),
    )
  ) {
    return null;
  }

  const parsed =
    Number(
      value
        .replace(
          /,/g,
          "",
        )
        .trim(),
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseCurrency(
  value: string | undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value.trim(),
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

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parsePercentage(
  value: string | undefined,
): number | null {
  if (
    !value ||
    /^N\/A$/i.test(
      value.trim(),
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
        )
        .trim(),
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function cleanAreaName(
  value: string,
): string {
  const cleaned =
    value
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

  /*
   * Fix typo contained in the source PDF.
   */
  return cleaned.replace(
    /\bWinsonville\b/gi,
    "Wilsonville",
  );
}