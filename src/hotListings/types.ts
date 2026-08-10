export interface SourceListing {
  mlsNumber: string;
  reportItemId?: string | null;
  address: string | null;
  currentPrice: number | null;
  originalPrice?: number | null;
  totalPriceReduction?: number | null;
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
  imageUrls?: string[];
  [key: string]: unknown;
}

export interface EnrichedListing extends SourceListing {
  city: string | null;
  citySlug: string | null;
  stateCode: "OR" | "WA" | null;
  listingBrokerage: string | null;
  bathrooms: number | null;
  pricePerSquareFoot: number | null;
}

export interface CachedHotListing extends EnrichedListing {
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ScoredListing extends EnrichedListing {
  score: number;
  scoreBreakdown: {
    freshness: number;
    value: number;
    utility: number;
    completeness: number;
  };
}

export interface WebsiteHotListing {
  mlsNumber: string;
  address: string;
  city: string;
  citySlug: string;
  stateCode: "OR" | "WA" | null;
  neighborhood: string | null;
  county: string | null;
  currentPrice: number;
  originalPrice: number | null;
  totalPriceReduction: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  acres: number | null;
  yearBuilt: number | null;
  imageUrl: string | null;
  imageUrls: string[];
  publicRemarks: string | null;
  propertyType: string | null;
  style: string | null;
  status: string | null;
  listDate: string | null;
  daysOnMarket: number | null;
  pricePerSquareFoot: number | null;
  score: number;
}

export interface WebsiteHotListingsPayload {
  schemaVersion: 1;
  source: "RMLS NEW ON MARKET";
  generatedAt: string;
  sourceEmailAt: string;
  freshnessHours: number;
  publicDisplayEnabled: boolean;
  displayLimit: number;
  topListings: WebsiteHotListing[];
  cities: Record<string, WebsiteHotListing[]>;
  neighborhoods: Record<string, WebsiteHotListing[]>;
  diagnostics: {
    sourceListings: number;
    rollingListings: number;
    eligibleListings: number;
    selectedListings: number;
    mappedToCity: number;
    withImage: number;
    withMultipleImages: number;
    withNeighborhood: number;
    withRemarks: number;
    withBrokerage: number;
  };
}
