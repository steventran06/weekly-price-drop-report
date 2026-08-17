import dotenv from "dotenv";

import {
  loadRecentlySentPostIds,
  sendRedditNotification,
  toSequenceId,
} from "./ntfy.js";
import type { NtfyConfig } from "./ntfy.js";
import {
  evaluateRelevance,
} from "./relevance.js";
import {
  createRedditApiClient,
  fetchNewPosts,
  mergeDuplicatePosts,
} from "./reddit.js";
import type {
  RedditApiConfig,
} from "./reddit.js";
import {
  buildSuggestedReply,
} from "./reply.js";
import {
  REDDIT_SOURCES,
} from "./sources.js";
import type {
  RedditPost,
} from "./types.js";

dotenv.config();

const DRY_RUN =
  process.env.REDDIT_ALERTS_DRY_RUN === "true";

const MAX_POST_AGE_MINUTES =
  parsePositiveNumber(
    process.env.REDDIT_MAX_POST_AGE_MINUTES,
    90,
  );

async function main(): Promise<void> {
  console.log("================================");
  console.log(" Reddit Relocation Lead Alerts");
  console.log("================================");
  console.log("Transport: Reddit OAuth Data API");
  console.log(`Sources: ${REDDIT_SOURCES.length}`);
  console.log(`Max post age: ${MAX_POST_AGE_MINUTES} minutes`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Reddit listing requests per run: ${REDDIT_SOURCES.length}`);

  const redditConfig = getRedditApiConfig();
  const ntfyConfig = getNtfyConfig();

  console.log("Authenticating with Reddit OAuth...");

  const redditClient =
    await createRedditApiClient(
      redditConfig,
    );

  console.log("Reddit OAuth authentication succeeded.");

  let sentIds = new Set<string>();

  if (!DRY_RUN) {
    console.log("Loading recent ntfy history for deduplication...");

    sentIds =
      await loadRecentlySentPostIds(
        ntfyConfig,
      );

    console.log(`Recently sent Reddit IDs: ${sentIds.size}`);
  }

  const allPosts: RedditPost[] = [];
  let sourceFailures = 0;

  for (const source of REDDIT_SOURCES) {
    try {
      console.log(`Fetching: ${source.label}`);

      const posts = await fetchNewPosts(
        redditClient,
        source,
      );

      console.log(`  ${posts.length} item(s)`);
      allPosts.push(...posts);
    } catch (error) {
      sourceFailures += 1;
      console.error(`  Source failed: ${formatError(error)}`);
    }
  }

  if (sourceFailures === REDDIT_SOURCES.length) {
    throw new Error(
      "Every Reddit API source failed. No notifications were attempted.",
    );
  }

  const posts = mergeDuplicatePosts(allPosts);

  console.log("");
  console.log(`Unique posts returned: ${posts.length}`);

  const cutoff =
    Date.now() -
    MAX_POST_AGE_MINUTES * 60_000;

  let relevantCount = 0;
  let notificationCount = 0;
  let rentalExcludedCount = 0;
  let staleCount = 0;
  let duplicateCount = 0;

  for (const post of posts) {
    if (post.publishedAt.getTime() < cutoff) {
      staleCount += 1;
      continue;
    }

    const relevance = evaluateRelevance(post);

    if (
      relevance.hasRentalIntent &&
      !relevance.hasBuyerIntent
    ) {
      rentalExcludedCount += 1;
    }

    if (!relevance.relevant) {
      continue;
    }

    relevantCount += 1;

    const sequenceId = toSequenceId(post.id);

    if (sentIds.has(sequenceId)) {
      duplicateCount += 1;
      continue;
    }

    const suggestedReply =
      buildSuggestedReply(
        post,
        relevance,
      );

    if (DRY_RUN) {
      printDryRunMatch(
        post,
        relevance,
        suggestedReply,
      );
      continue;
    }

    await sendRedditNotification(
      ntfyConfig,
      post,
      relevance,
      suggestedReply,
    );

    sentIds.add(sequenceId);
    notificationCount += 1;

    console.log(`Sent: ${post.title}`);
  }

  console.log("");
  console.log("Reddit alert summary");
  console.log("--------------------");
  console.log(`Relevant recent posts: ${relevantCount}`);
  console.log(`Notifications sent: ${notificationCount}`);
  console.log(`Already notified: ${duplicateCount}`);
  console.log(`Rental-only excluded: ${rentalExcludedCount}`);
  console.log(`Older than lookback: ${staleCount}`);
  console.log(`Source failures: ${sourceFailures}`);
}

function getRedditApiConfig(): RedditApiConfig {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
  const userAgent = process.env.REDDIT_USER_AGENT?.trim() || "";

  const missing = [
    !clientId ? "REDDIT_CLIENT_ID" : null,
    !clientSecret ? "REDDIT_CLIENT_SECRET" : null,
    !userAgent ? "REDDIT_USER_AGENT" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing Reddit API environment variable(s): ${missing.join(", ")}`,
    );
  }

  return {
    clientId,
    clientSecret,
    userAgent,
  };
}

function getNtfyConfig(): NtfyConfig {
  const topic = process.env.NTFY_TOPIC?.trim() ?? "";

  if (!DRY_RUN && !topic) {
    throw new Error("NTFY_TOPIC is required in live mode.");
  }

  if (
    topic &&
    !/^[-_A-Za-z0-9]{1,64}$/.test(topic)
  ) {
    throw new Error(
      "NTFY_TOPIC may contain only letters, numbers, dashes and underscores and must be 64 characters or fewer.",
    );
  }

  return {
    baseUrl:
      process.env.NTFY_BASE_URL?.trim() ||
      "https://ntfy.sh",
    topic,
  };
}

function printDryRunMatch(
  post: RedditPost,
  relevance: ReturnType<typeof evaluateRelevance>,
  suggestedReply: string,
): void {
  console.log("");
  console.log("================================");
  console.log(`MATCH: ${post.title}`);
  console.log(`Subreddit: ${post.subreddit ?? "unknown"}`);
  console.log(`Cities: ${relevance.cities.map((city) => city.name).join(", ")}`);
  console.log(`Score: ${relevance.score}`);
  console.log(`Reasons: ${relevance.reasons.join("; ")}`);
  console.log(`URL: ${post.url}`);
  console.log("");
  console.log(post.body.slice(0, 650));
  console.log("");
  console.log("SUGGESTED REPLY");
  console.log(suggestedReply);
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error("");
  console.error("Reddit alert workflow failed:");
  console.error(formatError(error));
  process.exitCode = 1;
});
