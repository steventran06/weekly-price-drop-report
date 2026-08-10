import type {
  EnrichedListing,
  ScoredListing,
} from "./types.js";

export function scoreListings(
  listings: EnrichedListing[],
): ScoredListing[] {
  const eligible = listings.filter(isEligibleListing);
  const cohorts = buildPpsfCohorts(eligible);

  return eligible
    .map((listing) => {
      const freshness = scoreFreshness(listing);
      const value = scoreValue(listing, cohorts);
      const utility = scoreUtility(listing);
      const completeness = scoreCompleteness(listing);
      const score = freshness + value + utility + completeness;

      return {
        ...listing,
        score,
        scoreBreakdown: {
          freshness,
          value,
          utility,
          completeness,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function isEligibleListing(listing: EnrichedListing): boolean {
  return Boolean(
    listing.mlsNumber &&
      listing.address &&
      listing.currentPrice &&
      listing.currentPrice > 0 &&
      listing.citySlug &&
      (!listing.status || /active|act/i.test(listing.status)),
  );
}

function buildPpsfCohorts(listings: EnrichedListing[]) {
  const cohorts = new Map<string, number[]>();

  for (const listing of listings) {
    if (!listing.pricePerSquareFoot || !listing.citySlug) continue;
    const key = cohortKey(listing);
    const values = cohorts.get(key) ?? [];
    values.push(listing.pricePerSquareFoot);
    cohorts.set(key, values);
  }

  for (const values of cohorts.values()) values.sort((a, b) => a - b);
  return cohorts;
}

function scoreFreshness(listing: EnrichedListing): number {
  const dom = listing.daysOnMarket;
  if (dom === null || dom === undefined) return 10;
  if (dom <= 0) return 20;
  if (dom === 1) return 18;
  if (dom === 2) return 15;
  if (dom === 3) return 12;
  if (dom <= 5) return 8;
  return 4;
}

function scoreValue(
  listing: EnrichedListing,
  cohorts: Map<string, number[]>,
): number {
  if (!listing.pricePerSquareFoot) return 8;

  const values = cohorts.get(cohortKey(listing)) ?? [];
  if (values.length < 4) return 12;

  const lowerCount = values.filter(
    (value) => value < listing.pricePerSquareFoot!,
  ).length;
  const percentile = lowerCount / values.length;

  if (percentile <= 0.1) return 40;
  if (percentile <= 0.25) return 34;
  if (percentile <= 0.4) return 27;
  if (percentile <= 0.6) return 20;
  if (percentile <= 0.75) return 12;
  return 5;
}

function scoreUtility(listing: EnrichedListing): number {
  let score = 0;

  if ((listing.bedrooms ?? 0) >= 4) score += 8;
  else if ((listing.bedrooms ?? 0) >= 3) score += 6;
  else if ((listing.bedrooms ?? 0) >= 2) score += 3;

  if ((listing.squareFeet ?? 0) >= 2500) score += 8;
  else if ((listing.squareFeet ?? 0) >= 1800) score += 6;
  else if ((listing.squareFeet ?? 0) >= 1200) score += 3;

  if ((listing.bathrooms ?? 0) >= 2) score += 4;

  return Math.min(score, 20);
}

function scoreCompleteness(listing: EnrichedListing): number {
  let score = 0;
  if (listing.imageUrl) score += 8;
  if (listing.listingBrokerage) score += 4;
  if (listing.neighborhood) score += 3;
  if (listing.squareFeet) score += 3;
  if (listing.bedrooms !== null) score += 2;
  return Math.min(score, 20);
}

function cohortKey(listing: EnrichedListing): string {
  return `${listing.citySlug}|${normalizePropertyType(listing.propertyType)}`;
}

function normalizePropertyType(value: string | null): string {
  const normalized = (value ?? "unknown").toLowerCase();
  if (/condo/.test(normalized)) return "condo";
  if (/attach|town/.test(normalized)) return "attached";
  if (/single|detach|residential/.test(normalized)) return "detached";
  return normalized || "unknown";
}
