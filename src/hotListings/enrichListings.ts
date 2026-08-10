import type {
  EnrichedListing,
  SourceListing,
} from "./types.js";

const CITY_SLUGS: Array<{
  name: string;
  slug: string;
  stateCode: "OR" | "WA";
  aliases?: string[];
}> = [
  { name: "Portland", slug: "portland", stateCode: "OR" },
  { name: "Beaverton", slug: "beaverton", stateCode: "OR" },
  { name: "Hillsboro", slug: "hillsboro", stateCode: "OR" },
  { name: "Tigard", slug: "tigard", stateCode: "OR" },
  { name: "Tualatin", slug: "tualatin", stateCode: "OR" },
  { name: "Sherwood", slug: "sherwood", stateCode: "OR" },
  { name: "Wilsonville", slug: "wilsonville", stateCode: "OR" },
  { name: "Lake Oswego", slug: "lake-oswego", stateCode: "OR" },
  { name: "West Linn", slug: "west-linn", stateCode: "OR" },
  { name: "Milwaukie", slug: "milwaukie", stateCode: "OR" },
  { name: "Happy Valley", slug: "happy-valley", stateCode: "OR" },
  { name: "Oregon City", slug: "oregon-city", stateCode: "OR" },
  { name: "Gresham", slug: "gresham", stateCode: "OR" },
  { name: "Troutdale", slug: "troutdale", stateCode: "OR" },
  { name: "Forest Grove", slug: "forest-grove", stateCode: "OR" },
  { name: "Cornelius", slug: "cornelius", stateCode: "OR" },
  { name: "North Plains", slug: "north-plains", stateCode: "OR" },
  { name: "Vancouver", slug: "vancouver", stateCode: "WA" },
  { name: "Camas", slug: "camas", stateCode: "WA" },
  { name: "Washougal", slug: "washougal", stateCode: "WA" },
  { name: "Ridgefield", slug: "ridgefield", stateCode: "WA" },
  {
    name: "Battle Ground",
    slug: "battle-ground",
    stateCode: "WA",
    aliases: ["Battleground"],
  },
  { name: "La Center", slug: "la-center", stateCode: "WA" },
];

export function enrichListings(
  listings: SourceListing[],
  html: string,
  sourceReportUrl: string | null = null,
): EnrichedListing[] {
  return listings.map((listing) => {
    const chunk = findListingChunk(html, listing.mlsNumber);
    const cityMatch = findCity(listing, chunk);
    const listingBrokerage =
      cleanString((listing as Record<string, unknown>).listingBrokerage) ??
      cleanString((listing as Record<string, unknown>).listingOffice) ??
      extractBrokerage(chunk);

    const neighborhood =
      cleanString(listing.neighborhood) ??
      extractNeighborhood(chunk) ??
      extractNeighborhoodFromRemarks(listing.remarks);

    const bathrooms = calculateBathrooms(
      listing.fullBathrooms,
      listing.partialBathrooms,
    );

    const pricePerSquareFoot =
      listing.currentPrice && listing.squareFeet && listing.squareFeet > 0
        ? Math.round(listing.currentPrice / listing.squareFeet)
        : null;

    return {
      ...listing,
      city: cityMatch?.name ?? null,
      citySlug: cityMatch?.slug ?? null,
      stateCode: cityMatch?.stateCode ?? inferStateCode(listing, chunk),
      neighborhood,
      listingBrokerage,
      bathrooms,
      pricePerSquareFoot,
      sourceReportUrl,
    };
  });
}

function findCity(
  listing: SourceListing,
  chunk: string | null,
) {
  const explicitCity = cleanString(
    (listing as Record<string, unknown>).city ??
      (listing as Record<string, unknown>).cityName,
  );

  const cityFromChunk = extractCityFromChunk(chunk);

  const haystack = [explicitCity, listing.address, cityFromChunk]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return CITY_SLUGS.find((city) => {
    const names = [city.name, ...(city.aliases ?? [])];
    return names.some((name) =>
      new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`, "i").test(
        haystack,
      ),
    );
  });
}

function extractCityFromChunk(chunk: string | null): string | null {
  if (!chunk) return null;
  const text = htmlToLines(chunk);
  const labels = ["Property City", "City", "City/State/Zip", "City State Zip"];

  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*:?\\s*(?:\\n\\s*)?([^\\n]{2,100})`,
      "i",
    );
    const match = text.match(pattern);
    if (match?.[1]) return cleanString(match[1]);
  }

  return null;
}

function inferStateCode(
  listing: SourceListing,
  chunk: string | null,
): "OR" | "WA" | null {
  const text = [listing.address, chunk].filter(Boolean).join(" ");
  if (/\bWA\b/i.test(text)) return "WA";
  if (/\bOR\b/i.test(text)) return "OR";
  return null;
}

function findListingChunk(html: string, mlsNumber: string): string | null {
  const marker = new RegExp(
    `<div[^>]+id=["']REPORT_ITEM_${escapeRegExp(mlsNumber)}_[^"']+["'][^>]*>`,
    "i",
  );

  const match = marker.exec(html);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const next = html.slice(start + match[0].length).search(
    /<div[^>]+id=["']REPORT_ITEM_\d+_[^"']+["'][^>]*>/i,
  );

  if (next < 0) return html.slice(start);
  return html.slice(start, start + match[0].length + next);
}

function extractNeighborhood(chunk: string | null): string | null {
  if (!chunk) return null;

  const text = htmlToLines(chunk);
  const labels = [
    "Neighborhood",
    "Subdivision",
    "Subdivision Name",
    "Legal Subdivision",
    "Community",
  ];

  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*:?\\s*(?:\\n\\s*)?([^\\n]{2,100})`,
      "i",
    );

    const match = text.match(pattern);
    const value = cleanNeighborhoodValue(match?.[1]);

    if (value) {
      return value;
    }
  }

  return null;
}

function extractNeighborhoodFromRemarks(remarks: string | null): string | null {
  const text = cleanString(remarks);
  if (!text) return null;

  /*
   * Use only explicit "___ neighborhood" language from the public remarks.
   * The website still requires an exact match against a configured neighborhood
   * name/map alias, so a generic phrase such as "Beaverton neighborhood" will
   * not place a listing on an unrelated neighborhood page.
   */
  const patterns = [
    /\b(?:in|within|inside)\s+(?:the\s+)?(?:highly\s+)?(?:sought[- ]after\s+|desirable\s+|popular\s+|coveted\s+|established\s+)?([A-Z][A-Za-z0-9'’&.-]*(?:\s+[A-Z][A-Za-z0-9'’&.-]*){0,5})\s+neighborhood\b/,
    /\b([A-Z][A-Za-z0-9'’&.-]*(?:\s+[A-Z][A-Za-z0-9'’&.-]*){0,5})\s+neighborhood\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanNeighborhoodValue(match?.[1]);

    if (value) {
      return value;
    }
  }

  return null;
}

function cleanNeighborhoodValue(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;

  const normalized = cleaned
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /^\d+$/.test(normalized)) return null;
  if (/^(area|neighborhood|community|subdivision|unknown|n\/?a)$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractBrokerage(chunk: string | null): string | null {
  if (!chunk) return null;

  const text = htmlToLines(chunk);
  const labels = [
    "Listing Office",
    "List Office",
    "Listing Firm",
    "List Firm",
    "Office Name",
    "Listing Brokerage",
  ];

  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*:?\\s*(?:\\n\\s*)?([^\\n]{2,120})`,
      "i",
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      return cleanString(match[1]);
    }
  }

  return null;
}

function htmlToLines(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n"),
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function calculateBathrooms(
  full: number | null,
  partial: number | null,
): number | null {
  if (full === null && partial === null) return null;
  return (full ?? 0) + (partial ?? 0) * 0.5;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(undefined|null|unknown|n\/a)$/i.test(trimmed)) return null;
  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
