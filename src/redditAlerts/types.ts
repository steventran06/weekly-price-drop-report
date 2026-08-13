import type {
  CityProfile,
} from "./cities.js";

export type FeedKind =
  | "local"
  | "relocation"
  | "living"
  | "buyer"
  | "global";

export type RedditFeed = {
  id: string;
  label: string;
  url: string;
  kind: FeedKind;
};

export type RedditPost = {
  id: string;
  title: string;
  url: string;
  subreddit: string | null;
  author: string | null;
  publishedAt: Date;
  body: string;
  feedIds: string[];
  feedKinds: FeedKind[];
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
