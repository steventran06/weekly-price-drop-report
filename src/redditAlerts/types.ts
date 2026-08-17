import type { CityProfile } from "./cities.js";

export type SourceKind =
  | "local"
  | "relocation"
  | "living"
  | "buyer";

export type RedditSource = {
  id: string;
  label: string;
  subreddits: readonly string[];
  kind: SourceKind;
  limit: number;
};

export type RedditPost = {
  id: string;
  title: string;
  url: string;
  subreddit: string | null;
  author: string | null;
  publishedAt: Date;
  body: string;
  sourceIds: string[];
  sourceKinds: SourceKind[];
};

export type RelevanceResult = {
  relevant: boolean;
  score: number;
  reasons: string[];
  cities: CityProfile[];
  hasBuyerIntent: boolean;
  hasMovingIntent: boolean;
  hasRentalIntent: boolean;
};
