import dotenv from "dotenv";

import {
  REDDIT_FEEDS,
  printFeedUrls,
} from "./feeds.js";
import {
  evaluateRelevance,
} from "./relevance.js";
import {
  buildSuggestedReply,
} from "./reply.js";
import {
  fetchRedditFeed,
  mergeDuplicatePosts,
} from "./reddit.js";
import {
  loadRecentlySentPostIds,
  sendRedditNotification,
  toSequenceId,
} from "./ntfy.js";
import type {
  NtfyConfig,
} from "./ntfy.js";

dotenv.config();

const DRY_RUN =
  process.env.REDDIT_ALERTS_DRY_RUN ===
  "true";

const MAX_POST_AGE_MINUTES =
  parsePositiveNumber(
    process.env.REDDIT_MAX_POST_AGE_MINUTES,
    90,
  );

async function main(): Promise<void> {
  console.log(
    "================================",
  );
  console.log(
    " Reddit Relocation Lead Alerts",
  );
  console.log(
    "================================",
  );
  console.log(
    `Feeds: ${REDDIT_FEEDS.length}`,
  );
  console.log(
    `Max post age: ${MAX_POST_AGE_MINUTES} minutes`,
  );
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );
  console.log(
    `Reddit discovery requests per run: ${REDDIT_FEEDS.length}`,
  );

  if (
    process.env.REDDIT_PRINT_FEEDS ===
    "true"
  ) {
    printFeedUrls();
  }

  const ntfyConfig =
    getNtfyConfig();

  let sentIds =
    new Set<string>();

  if (!DRY_RUN) {
    console.log(
      "Loading recent ntfy history for deduplication...",
    );

    sentIds =
      await loadRecentlySentPostIds(
        ntfyConfig,
      );

    console.log(
      `Recently sent Reddit IDs: ${sentIds.size}`,
    );
  }

  const allPosts = [];
  let feedFailures = 0;

  for (const feed of REDDIT_FEEDS) {
    try {
      console.log(
        `Fetching: ${feed.label}`,
      );

      const posts =
        await fetchRedditFeed(
          feed,
        );

      console.log(
        `  ${posts.length} item(s)`,
      );

      allPosts.push(
        ...posts,
      );
    } catch (error) {
      feedFailures += 1;

      console.error(
        `  Feed failed: ${formatError(error)}`,
      );
    }
  }

  if (
    feedFailures ===
    REDDIT_FEEDS.length
  ) {
    throw new Error(
      "Every Reddit RSS feed failed. No notifications were attempted.",
    );
  }

  const posts =
    mergeDuplicatePosts(
      allPosts,
    );

  console.log("");
  console.log(
    `Unique posts returned: ${posts.length}`,
  );

  const cutoff =
    Date.now() -
    MAX_POST_AGE_MINUTES *
      60_000;

  let relevantCount = 0;
  let notificationCount = 0;
  let rentalExcludedCount = 0;
  let staleCount = 0;
  let duplicateCount = 0;

  for (const post of posts) {
    if (
      post.publishedAt.getTime() <
      cutoff
    ) {
      staleCount += 1;
      continue;
    }

    const relevance =
      evaluateRelevance(
        post,
      );

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

    const sequenceId =
      toSequenceId(
        post.id,
      );

    if (
      sentIds.has(
        sequenceId,
      )
    ) {
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

    sentIds.add(
      sequenceId,
    );
    notificationCount += 1;

    console.log(
      `Sent: ${post.title}`,
    );
  }

  console.log("");
  console.log(
    "Reddit alert summary",
  );
  console.log(
    "--------------------",
  );
  console.log(
    `Relevant recent posts: ${relevantCount}`,
  );
  console.log(
    `Notifications sent: ${notificationCount}`,
  );
  console.log(
    `Already notified: ${duplicateCount}`,
  );
  console.log(
    `Rental-only excluded: ${rentalExcludedCount}`,
  );
  console.log(
    `Older than lookback: ${staleCount}`,
  );
  console.log(
    `Feed failures: ${feedFailures}`,
  );
}

function getNtfyConfig(): NtfyConfig {
  const topic =
    process.env.NTFY_TOPIC?.trim() ??
    "";

  if (
    !DRY_RUN &&
    !topic
  ) {
    throw new Error(
      "NTFY_TOPIC is required in live mode.",
    );
  }

  if (
    topic &&
    !/^[-_A-Za-z0-9]{1,64}$/.test(
      topic,
    )
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
  post: {
    title: string;
    url: string;
    subreddit: string | null;
    body: string;
  },
  relevance: ReturnType<
    typeof evaluateRelevance
  >,
  suggestedReply: string,
): void {
  console.log("");
  console.log(
    "================================",
  );
  console.log(
    `MATCH: ${post.title}`,
  );
  console.log(
    `Subreddit: ${post.subreddit ?? "unknown"}`,
  );
  console.log(
    `Cities: ${relevance.cities.map((city) => city.name).join(", ")}`,
  );
  console.log(
    `Score: ${relevance.score}`,
  );
  console.log(
    `Reasons: ${relevance.reasons.join("; ")}`,
  );
  console.log(
    `URL: ${post.url}`,
  );
  console.log("");
  console.log(
    post.body.slice(
      0,
      650,
    ),
  );
  console.log("");
  console.log(
    "SUGGESTED REPLY",
  );
  console.log(
    suggestedReply,
  );
}


function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function formatError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error("");
  console.error(
    "Reddit alert workflow failed:",
  );
  console.error(
    formatError(error),
  );
  process.exitCode = 1;
});
