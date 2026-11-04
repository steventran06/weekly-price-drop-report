import type { RmlsListing } from "../rmls/parseListings.js";

export function usableUniqueListings(listings: RmlsListing[]): RmlsListing[] {
  const seen = new Set<string>();
  return listings.filter(listing => {
    if (!listing.mlsNumber || !listing.address?.trim() ||
        listing.currentPrice === null || !Number.isFinite(listing.currentPrice) ||
        listing.currentPrice <= 0 || seen.has(listing.mlsNumber)) return false;
    seen.add(listing.mlsNumber);
    return true;
  });
}

export function prioritizeListings(newest: RmlsListing[], complete: RmlsListing[] = []) {
  const primary = usableUniqueListings(newest);
  if (primary.length >= 5) return { listings: primary, requiredMlsNumbers: [] as string[] };
  return {
    listings: usableUniqueListings([...primary, ...complete]),
    requiredMlsNumbers: primary.map(listing => listing.mlsNumber),
  };
}
