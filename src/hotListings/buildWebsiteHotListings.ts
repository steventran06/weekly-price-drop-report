import type {
  ScoredListing,
  WebsiteHotListing,
  WebsiteHotListingsPayload,
} from "./types.js";

const DISPLAY_LIMIT = 8;
const FRESHNESS_HOURS = 72;
const NEIGHBORHOOD_LIMIT = 6;
const HOMEPAGE_LIMIT = 20;

export function buildWebsiteHotListings(
  sourceListings: ScoredListing[],
  totalSourceListings: number,
  sourceEmailAt: string,
  rollingListings: number = sourceListings.length,
): WebsiteHotListingsPayload {
  const publicDisplayEnabled =
    /^true$/i.test(process.env.HOT_LISTINGS_PUBLIC_DISPLAY?.trim() ?? "false");

  const cities: Record<string, WebsiteHotListing[]> = {};
  const neighborhoods: Record<string, WebsiteHotListing[]> = {};

  const topListings = sourceListings
    .filter(
      (listing) =>
        listing.citySlug &&
        listing.city &&
        listing.address &&
        listing.currentPrice,
    )
    .slice(0, HOMEPAGE_LIMIT)
    .map(toWebsiteListing);

  for (const listing of sourceListings) {
    if (!listing.citySlug || !listing.city || !listing.address || !listing.currentPrice) {
      continue;
    }

    const cityListings = cities[listing.citySlug] ?? [];

    if (cityListings.length >= DISPLAY_LIMIT) continue;

    cityListings.push(toWebsiteListing(listing));
    cities[listing.citySlug] = cityListings;
  }

  for (const listing of sourceListings) {
    if (!listing.citySlug || !listing.neighborhood || !listing.address || !listing.currentPrice) {
      continue;
    }

    const key = `${listing.citySlug}/${slugify(listing.neighborhood)}`;
    const neighborhoodListings = neighborhoods[key] ?? [];

    if (neighborhoodListings.length >= NEIGHBORHOOD_LIMIT) continue;

    neighborhoodListings.push(toWebsiteListing(listing));
    neighborhoods[key] = neighborhoodListings;
  }

  const selected = Object.values(cities).flat();

  return {
    schemaVersion: 1,
    source: "RMLS NEW ON MARKET",
    generatedAt: new Date().toISOString(),
    sourceEmailAt,
    freshnessHours: FRESHNESS_HOURS,
    publicDisplayEnabled,
    displayLimit: DISPLAY_LIMIT,
    topListings,
    cities,
    neighborhoods,
    diagnostics: {
      sourceListings: totalSourceListings,
      rollingListings,
      eligibleListings: sourceListings.length,
      selectedListings: selected.length,
      mappedToCity: sourceListings.filter((listing) => listing.citySlug).length,
      withImage: sourceListings.filter((listing) => listing.imageUrl).length,
      withNeighborhood: sourceListings.filter((listing) => listing.neighborhood).length,
      withBrokerage: sourceListings.filter((listing) => listing.listingBrokerage).length,
    },
  };
}

function toWebsiteListing(listing: ScoredListing): WebsiteHotListing {
  return {
    mlsNumber: listing.mlsNumber,
    address: listing.address!,
    city: listing.city!,
    citySlug: listing.citySlug!,
    stateCode: listing.stateCode,
    neighborhood: listing.neighborhood,
    currentPrice: listing.currentPrice!,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    squareFeet: listing.squareFeet,
    imageUrl: listing.imageUrl,
    listingBrokerage: listing.listingBrokerage,
    propertyType: listing.propertyType,
    listDate: listing.listDate,
    daysOnMarket: listing.daysOnMarket,
    score: listing.score,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
