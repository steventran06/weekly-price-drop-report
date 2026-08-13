import {
  buildCitySearchTerms,
} from "./cities.js";
import {
  BUYER_SUBREDDITS,
  LIVING_SUBREDDITS,
  LOCAL_SUBREDDITS,
  RELOCATION_SUBREDDITS,
} from "./subreddits.js";
import type {
  RedditFeed,
} from "./types.js";

const LOCAL_INTENT_QUERY = buildOrQuery([
  "moving",
  "relocating",
  '"move to"',
  '"moving to"',
  '"looking to move"',
  "buying",
  '"buy a home"',
  '"buying a home"',
  '"buy a house"',
  '"buying a house"',
  "homebuyer",
  "mortgage",
  "realtor",
  '"real estate agent"',
  '"investment property"',
]);

const BUYER_MOVE_QUERY = buildOrQuery([
  "moving",
  "relocating",
  '"move to"',
  '"moving to"',
  '"looking to move"',
  "buying",
  '"looking to buy"',
  "homebuyer",
  "mortgage",
  '"pre approval"',
  '"pre-approved"',
  "realtor",
  '"investment property"',
]);

const ALL_CITY_QUERY = buildOrQuery(
  buildCitySearchTerms(),
);

const LOCAL_SUBREDDIT_QUERY =
  buildSubredditQuery(LOCAL_SUBREDDITS);

const RELOCATION_LIVING_SUBREDDIT_QUERY =
  buildSubredditQuery([
    ...RELOCATION_SUBREDDITS,
    ...LIVING_SUBREDDITS,
  ]);

const BUYER_SUBREDDIT_QUERY =
  buildSubredditQuery(BUYER_SUBREDDITS);

/*
 * One Reddit request covers three logical discovery strategies:
 *
 * 1. Local subreddits: location is implied by the subreddit, so search intent.
 * 2. Relocation/living subreddits: search all service-area city names.
 * 3. Buyer/real-estate subreddits: require both city and buyer/move intent.
 *
 * Reddit's own search narrows discovery; relevance.ts remains the final filter.
 */
const COMBINED_QUERY = [
  `(${LOCAL_SUBREDDIT_QUERY} AND ${LOCAL_INTENT_QUERY})`,
  `(${RELOCATION_LIVING_SUBREDDIT_QUERY} AND ${ALL_CITY_QUERY})`,
  `(${BUYER_SUBREDDIT_QUERY} AND ${ALL_CITY_QUERY} AND ${BUYER_MOVE_QUERY})`,
].join(" OR ");

export const REDDIT_FEEDS: RedditFeed[] = [
  {
    id: "combined-relocation-leads",
    label:
      "Combined Reddit discovery — local + relocation + buyer communities",
    kind: "global",
    url: buildGlobalSearchFeed(
      COMBINED_QUERY,
      100,
    ),
  },
];

export function printFeedUrls(): void {
  for (const feed of REDDIT_FEEDS) {
    console.log(`\n${feed.label}`);
    console.log(feed.url);
  }
}

function buildOrQuery(
  terms: readonly string[],
): string {
  return `(${terms.join(" OR ")})`;
}

function buildSubredditQuery(
  subreddits: readonly string[],
): string {
  return buildOrQuery(
    subreddits.map(
      (subreddit) => `subreddit:${subreddit}`,
    ),
  );
}

function buildGlobalSearchFeed(
  query: string,
  limit: number,
): string {
  const params = new URLSearchParams({
    q: query,
    sort: "new",
    limit: String(limit),
  });

  return (
    "https://www.reddit.com/search.rss?" +
    params.toString()
  );
}
