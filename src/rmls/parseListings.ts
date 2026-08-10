import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

export interface RmlsListing {
  mlsNumber: string;
  reportItemId: string | null;
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
  imageUrls: string[];
  originalPrice: number | null;
  totalPriceReduction: number | null;
}

interface ListingChunk {
  mlsNumber: string;
  reportItemId: string;
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
    /<div\s+id=["'](REPORT_ITEM_(\d+)_(\d+))["'][^>]*><\/div>/gi;

  const matches = [...html.matchAll(markerPattern)];
  const chunks: ListingChunk[] = [];

  for (const [index, match] of matches.entries()) {
    const reportItemId = match[1];
    const mlsNumber = match[2];
    const start = match.index;

    if (!reportItemId || !mlsNumber || start === undefined) {
      continue;
    }

    const nextMatch = matches[index + 1];
    const end =
      nextMatch?.index !== undefined
        ? nextMatch.index
        : html.length;

    chunks.push({
      mlsNumber,
      reportItemId,
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

  const imageUrls = extractImageUrls(
    $,
    chunk.mlsNumber,
    chunk.html,
  );

  return {
    mlsNumber: chunk.mlsNumber,
    reportItemId: chunk.reportItemId,
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
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
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

const DEFAULT_MAX_LISTING_PHOTOS = 20;
const MAX_LISTING_PHOTOS_CAP = 50;

function extractImageUrls(
  $: cheerio.CheerioAPI,
  mlsNumber: string,
  rawHtml: string,
): string[] {
  const selectors = [
    "img.PHOTO_NEW",
    "img[class*='PHOTO']",
    "img[src*='photo']",
  ];

  const seen = new Set<string>();
  const urls: string[] = [];

  const addUrl = (value: string | null | undefined): void => {
    const src = value?.trim();

    if (!src) {
      return;
    }

    let url = src;

    try {
      url = new URL(
        src,
        "https://www.rmlsweb.com",
      ).toString();
    } catch {
      // Keep the original source if URL normalization fails.
    }

    if (
      !seen.has(url) &&
      !/spacer|blank|pixel|transparent|nophoto/i.test(url)
    ) {
      seen.add(url);
      urls.push(url);
    }
  };

  /*
   * RMLS renders only photo #1 as an <img>, but its Client Full HTML also
   * contains the folder used by the photo viewer plus navigation entries for
   * every available photo. Reconstruct those URLs so the consumer modal can
   * show a real gallery instead of a single image.
   */
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      addUrl($(element).attr("src"));
    });
  }

  const photoFolder = extractPhotoFolder(
    rawHtml,
    mlsNumber,
  );

  const photoCount = extractPhotoCount(
    rawHtml,
    mlsNumber,
  );

  if (
    photoFolder &&
    photoCount > 1
  ) {
    const cacheBust = extractPhotoCacheBust(
      urls[0] ?? null,
    );

    const limit = Math.min(
      photoCount,
      getMaxListingPhotos(),
    );

    for (let index = 1; index <= limit; index++) {
      addUrl(
        `/webphotos/${photoFolder}` +
          `${mlsNumber}-${index}-a.jpg${cacheBust}`,
      );
    }
  }

  return urls.slice(
    0,
    getMaxListingPhotos(),
  );
}

function extractPhotoFolder(
  rawHtml: string,
  mlsNumber: string,
): string | null {
  const escapedMls = escapeRegExp(mlsNumber);
  const pattern = new RegExp(
    `photourls\\[['"]photo${escapedMls}['"]\\]\\s*=\\s*['"]([^'"]+)['"]`,
    "i",
  );

  const match = rawHtml.match(pattern);
  const folder = match?.[1]
    ?.replace(/^\/+|\/+$/g, "")
    .trim();

  return folder
    ? `${folder}/`
    : null;
}

function extractPhotoCount(
  rawHtml: string,
  mlsNumber: string,
): number {
  const escapedMls = escapeRegExp(mlsNumber);
  const indexes: number[] = [];

  const navPattern = new RegExp(
    `PHOTONAV__${escapedMls}_(\\d+)`,
    "gi",
  );

  for (const match of rawHtml.matchAll(navPattern)) {
    const value = Number(match[1]);

    if (Number.isInteger(value) && value > 0) {
      indexes.push(value);
    }
  }

  if (indexes.length > 0) {
    return Math.max(...indexes);
  }

  const captionPattern = new RegExp(
    `photocaptions\\[['"]photo${escapedMls}['"]\\]\\[(\\d+)\\]`,
    "gi",
  );

  for (const match of rawHtml.matchAll(captionPattern)) {
    const value = Number(match[1]);

    if (Number.isInteger(value) && value > 0) {
      indexes.push(value);
    }
  }

  return indexes.length > 0
    ? Math.max(...indexes)
    : 0;
}

function extractPhotoCacheBust(
  firstImageUrl: string | null,
): string {
  if (!firstImageUrl) {
    return "";
  }

  try {
    return new URL(firstImageUrl).search;
  } catch {
    const queryIndex = firstImageUrl.indexOf("?");
    return queryIndex >= 0
      ? firstImageUrl.slice(queryIndex)
      : "";
  }
}

function getMaxListingPhotos(): number {
  const configured = Number(
    process.env.HOT_LISTINGS_MAX_PHOTOS ??
      DEFAULT_MAX_LISTING_PHOTOS,
  );

  if (
    !Number.isFinite(configured) ||
    configured < 2
  ) {
    return DEFAULT_MAX_LISTING_PHOTOS;
  }

  return Math.min(
    Math.round(configured),
    MAX_LISTING_PHOTOS_CAP,
  );
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
