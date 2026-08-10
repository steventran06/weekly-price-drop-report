export interface NewConstructionIncentive {
  headline: string;
  description: string;
  type:
    | "rate-buydown"
    | "closing-cost"
    | "design-credit"
    | "price-reduction"
    | "upgrade"
    | "other";
  amount: number | null;
  interestRate: string;
  appliesTo: string;
  requirements: string;
  expirationDate: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface NumericRangeDetail {
  min: number | null;
  max: number | null;
  text: string;
}

export interface PriceRangeDetail {
  from: number | null;
  to: number | null;
  text: string;
}

export interface HoaDetail {
  amount: number | null;
  frequency: string;
  text: string;
}

export interface NewConstructionCommunityDetails {
  pricing: PriceRangeDetail;
  squareFeet: NumericRangeDetail;
  bedrooms: NumericRangeDetail;
  bathrooms: NumericRangeDetail;
  floorPlanCount: number | null;
  quickMoveInCount: number | null;
  quickMoveInUrl: string;
  modelHomeAddress: string;
  salesOfficeHours: string;
  hoa: HoaDetail;
  amenities: string[];
  highlights: string[];
  incentives: NewConstructionIncentive[];
}

export interface NewConstructionBuilder {
  id: string;
  name: string;
  domain: string;
  website: string;
  sourceUrl?: string;
  logoPath?: string;
  summary?: string;
  incentives?: NewConstructionIncentive[];
  lastVerified?: string;
  [key: string]: unknown;
}

export interface NewConstructionCommunity {
  id?: string;
  builderId: string;
  name: string;
  city: string;
  citySlug: string;
  neighborhoodSlugs?: string[];
  status: string;
  homeType: string;
  sourceUrl: string;
  lastVerified: string;
  note?: string;
  imageUrl?: string;
  imageSourceUrl?: string;
  imageAlt?: string;
  details?: NewConstructionCommunityDetails;
  [key: string]: unknown;
}

export interface NewConstructionData {
  schemaVersion?: number;
  lastVerified: string;
  freshnessDays?: number;
  intro?: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
  builders: NewConstructionBuilder[];
  communities: NewConstructionCommunity[];
  feedMeta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CommunityResearchUpdate {
  name: string;
  city: string;
  status: string;
  homeType: string;
  sourceUrl: string;
  note: string;
  details: NewConstructionCommunityDetails;
}

export interface CommunityRemoval {
  name: string;
  sourceUrl: string;
  reason: string;
}

export interface ResearchedCommunity {
  name: string;
  city: string;
  status: string;
  homeType: string;
  sourceUrl: string;
  note: string;
  details: NewConstructionCommunityDetails;
}

export interface BuilderResearchResult {
  builderIncentives: NewConstructionIncentive[];
  verifiedExistingNames: string[];
  communityUpdates: CommunityResearchUpdate[];
  removals: CommunityRemoval[];
  newCommunities: ResearchedCommunity[];
  researchNotes: string[];
}

export interface ResearchAudit {
  builderId: string;
  builderName: string;
  previousCount: number;
  finalCount: number;
  kept: number;
  updated: number;
  removed: number;
  uncertain: number;
  added: number;
  builderIncentiveCount: number;
  communityIncentiveCount: number;
  failed: boolean;
  error: string;
  notes: string[];
}
