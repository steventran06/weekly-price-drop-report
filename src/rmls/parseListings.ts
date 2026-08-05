import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

export interface RmlsListing {
  mlsNumber: string;
  address: string | null;
  currentPrice: number | null;
  bedrooms: number | null;
  fullBathrooms: number | null;
  partialBathrooms: number | null;
  squareFeet: number | null;
  status: string | null;
  listDate: string | null;
  daysOnMarket: number | null;
  acres: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  style: string | null;
  county: string | null;
  neighborhood: string | null;
  remarks: string | null;
  imageUrl: string | null;
  originalPrice: number | null;
  totalPriceReduction: number | null;
}

interface ListingChunk {
  mlsNumber: string;
  html: string;
}

export async function parseSavedRmlsReport(): Promise<RmlsListing[]> {
  const reportPath = path.join(
    process.cwd(),
    "output",
    "rmls-report.html",
  );

  const html = await fs.readFile(reportPath, "utf8");
  const chunks = splitReportIntoListingChunks(html);

  console.log(
    `Found ${chunks.length} RMLS listing chunk(s) in HTML.`,
  );

  return chunks.map(parseListingChunk);
}

/**
 * RMLS outputs malformed nested table markup. DOM parsers can relocate the
 * REPORT_ITEM marker, so listing boundaries are determined from the raw HTML.
 */
function splitReportIntoListingChunks(
  html: string,
): ListingChunk[] {
  const markerPattern =
    /<div\s+id=["']REPORT_ITEM_(\d+)_\d+["'][^>]*><\/div>/gi;

  const matches = [...html.matchAll(markerPattern)];
  const chunks: ListingChunk[] = [];

  for (const [index, match] of matches.entries()) {
    const mlsNumber = match[1];
    const start = match.index;

    if (!mlsNumber || start === undefined) {
      continue;
    }

    const nextMatch = matches[index + 1];
    const end =
      nextMatch?.index !== undefined
        ? nextMatch.index
        : html.length;

    chunks.push({
      mlsNumber,
      html: html.slice(start, end),
    });
  }

  return chunks;
}

function parseListingChunk(
  chunk: ListingChunk,
): RmlsListing {
  const $ = cheerio.load(chunk.html);
  const bodyText = cleanText($.root().text());

  const priceText = cleanText(
    $("[id='PRICE']").first().text(),
  );

  const bedBathText = cleanText(
    $("[id='BED_BATH']").first().text(),
  );

  const addressText = cleanAddress(
    $("[id='ADDRESS']").first().text(),
  );

  const bedBath = parseBedBathSqft(bedBathText);

  const currentPrice = parseCurrency(priceText);

  const originalPrice = extractOriginalPrice($);

  const totalPriceReduction =
    currentPrice !== null &&
    originalPrice !== null &&
    originalPrice >= currentPrice
      ? originalPrice - currentPrice
      : null;

  return {
    mlsNumber: chunk.mlsNumber,
    address: addressText || null,
    currentPrice,
    originalPrice,
    totalPriceReduction,
    bedrooms: bedBath.bedrooms,
    fullBathrooms: bedBath.fullBathrooms,
    partialBathrooms: bedBath.partialBathrooms,
    squareFeet: bedBath.squareFeet,
    status:
      cleanText($(".STATUSVALUE").first().text()) ||
      extractLabeledValue(bodyText, "Status", [
        "List Date",
        "DOM",
      ]),
    listDate: extractLabeledValue(bodyText, "List Date", [
      "DOM",
      "Acres",
    ]),
    daysOnMarket: parseInteger(
      extractLabeledValue(bodyText, "DOM", [
        "Acres",
        "MLS#",
      ]),
    ),
    acres: parseDecimal(
      extractLabeledValue(bodyText, "Acres", [
        "MLS#",
        "Year Built",
      ]),
    ),
    yearBuilt: extractYearBuilt(bodyText),
    propertyType: extractLabeledValue(
      bodyText,
      "Property Type",
      ["Style", "County"],
    ),
    style: extractLabeledValue(bodyText, "Style", [
      "County",
      "Nhood/Bldg",
    ]),
    county: extractLabeledValue(bodyText, "County", [
      "Nhood/Bldg",
      "CC&Rs",
    ]),
    neighborhood: extractLabeledValue(
      bodyText,
      "Nhood/Bldg",
      ["CC&Rs", "Legal"],
    ),
    remarks: extractRemarks($),
    imageUrl: extractPrimaryImageUrl($),
  };
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAddress(value: string): string {
  return cleanText(value)
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*(OR|WA)\s*/i, ", $1 ")
    .replace(/\s+(\d{5})(?:-\d{4})?$/, " $1");
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^\d]/g, "");

  return cleaned ? Number(cleaned) : null;
}

function parseBedBathSqft(value: string): {
  bedrooms: number | null;
  fullBathrooms: number | null;
  partialBathrooms: number | null;
  squareFeet: number | null;
} {
  const match = value.match(
    /(\d+(?:\.\d+)?)\s*bd\s*\|\s*(\d+)\s*\/\s*(\d+)\s*ba\s*\|\s*([\d,]+)\s*sqft/i,
  );

  if (!match) {
    return {
      bedrooms: null,
      fullBathrooms: null,
      partialBathrooms: null,
      squareFeet: null,
    };
  }

  return {
    bedrooms: Number(match[1]),
    fullBathrooms: Number(match[2]),
    partialBathrooms: Number(match[3]),
    squareFeet: Number(match[4].replace(/,/g, "")),
  };
}

function extractYearBuilt(text: string): number | null {
  const match = text.match(/Year Built:\s*(\d{4})/i);

  return match?.[1] ? Number(match[1]) : null;
}

function extractLabeledValue(
  text: string,
  label: string,
  followingLabels: string[],
): string | null {
  const escapedLabel = escapeRegExp(label);

  const lookahead =
    followingLabels.length > 0
      ? `(?=(?:${followingLabels
          .map(escapeRegExp)
          .join("|")}):|$)`
      : "$";

  const pattern = new RegExp(
    `${escapedLabel}:\\s*(.*?)\\s*${lookahead}`,
    "i",
  );

  const match = text.match(pattern);
  const value = match?.[1] ? cleanText(match[1]) : "";

  return value || null;
}

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+/);

  return match ? Number(match[0]) : null;
}

function parseDecimal(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;
}

function extractRemarks(
  $: cheerio.CheerioAPI,
): string | null {
  const selectors = [
    "p.data.dont-break-out",
    ".remarks",
    "[class*='remark']",
  ];

  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());

    if (value) {
      return value;
    }
  }

  return null;
}

function extractPrimaryImageUrl(
  $: cheerio.CheerioAPI,
): string | null {
  const selectors = [
    "img.PHOTO_NEW",
    "img[class*='PHOTO']",
    "img[src*='photo']",
  ];

  for (const selector of selectors) {
    const src = $(selector).first().attr("src");

    if (!src) {
      continue;
    }

    try {
      return new URL(
        src,
        "https://www.rmlsweb.com",
      ).toString();
    } catch {
      return src;
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function extractOriginalPrice(
  $: cheerio.CheerioAPI,
): number | null {
  const originalPriceLabel = $("label")
    .filter((_, element) => {
      return cleanText($(element).text())
        .toLowerCase() === "original price:";
    })
    .first();

  if (originalPriceLabel.length === 0) {
    return null;
  }

  const priceText = cleanText(
    originalPriceLabel.next(".data").first().text(),
  );

  return parseCurrency(priceText);
}