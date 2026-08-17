import {
  BUYER_SUBREDDITS,
  LIVING_SUBREDDITS,
  LOCAL_SUBREDDITS,
  RELOCATION_SUBREDDITS,
} from "./subreddits.js";
import type { RedditSource } from "./types.js";

/*
 * Keep Reddit discovery intentionally broad and cheap.
 *
 * We fetch the newest posts from three subreddit groups and let our own
 * deterministic TypeScript relevance filter decide what matters. This avoids
 * Reddit search syntax entirely and keeps API usage to three listing requests
 * per poll.
 */
export const REDDIT_SOURCES: RedditSource[] = [
  {
    id: "local",
    label: "Portland Metro + SW Washington local communities",
    subreddits: LOCAL_SUBREDDITS,
    kind: "local",
    limit: 100,
  },
  {
    id: "relocation",
    label: "Relocation + living-comparison communities",
    subreddits: [
      ...RELOCATION_SUBREDDITS,
      ...LIVING_SUBREDDITS,
    ],
    kind: "relocation",
    limit: 100,
  },
  {
    id: "buyer",
    label: "Homebuyer + real-estate communities",
    subreddits: BUYER_SUBREDDITS,
    kind: "buyer",
    limit: 100,
  },
];
