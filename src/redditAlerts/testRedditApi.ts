import dotenv from "dotenv";

import {
  createRedditApiClient,
  fetchNewPosts,
} from "./reddit.js";
import {
  REDDIT_SOURCES,
} from "./sources.js";

dotenv.config();

async function main(): Promise<void> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
  const userAgent = process.env.REDDIT_USER_AGENT?.trim() || "";

  if (!clientId || !clientSecret || !userAgent) {
    throw new Error(
      "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET and REDDIT_USER_AGENT are required.",
    );
  }

  console.log("Authenticating with Reddit OAuth...");

  const client = await createRedditApiClient({
    clientId,
    clientSecret,
    userAgent,
  });

  console.log("OAuth token acquired.");

  const source = REDDIT_SOURCES[0];

  if (!source) {
    throw new Error("No Reddit sources are configured.");
  }

  console.log(`Fetching a test listing from: ${source.label}`);

  const posts = await fetchNewPosts(
    client,
    {
      ...source,
      limit: 5,
    },
  );

  console.log(`Reddit API test succeeded: ${posts.length} post(s) returned.`);

  for (const post of posts.slice(0, 5)) {
    console.log(`- r/${post.subreddit ?? "unknown"}: ${post.title}`);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
});
