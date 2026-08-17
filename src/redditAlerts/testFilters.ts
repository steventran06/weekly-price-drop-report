import { evaluateRelevance } from "./relevance.js";
import type { RedditPost } from "./types.js";

const cases: Array<{
  name: string;
  post: RedditPost;
  expected: boolean;
}> = [
  {
    name: "Portland relocation buyer",
    expected: true,
    post: makePost({
      title: "Moving to Portland and hoping to buy next spring",
      body: "We are relocating for work and looking to buy around $700k. Any advice on Beaverton versus Portland?",
      subreddit: "relocating",
    }),
  },
  {
    name: "Beaverton rental only",
    expected: false,
    post: makePost({
      title: "Moving to Beaverton and looking for an apartment",
      body: "We need a rental and would like to sign a lease in September.",
      subreddit: "Beaverton",
    }),
  },
  {
    name: "Vancouver BC rental",
    expected: false,
    post: makePost({
      title: "Moving to Vancouver BC",
      body: "Looking for a rental apartment in British Columbia, Canada.",
      subreddit: "Moving",
    }),
  },
];

let failures = 0;

for (const testCase of cases) {
  const result = evaluateRelevance(testCase.post);
  const pass = result.relevant === testCase.expected;

  console.log(
    `${pass ? "PASS" : "FAIL"}: ${testCase.name} -> relevant=${result.relevant}, score=${result.score}`,
  );

  if (!pass) {
    failures += 1;
  }
}

if (failures > 0) {
  process.exitCode = 1;
}

function makePost(
  input: {
    title: string;
    body: string;
    subreddit: string;
  },
): RedditPost {
  return {
    id: `t3_test_${Math.random().toString(16).slice(2)}`,
    title: input.title,
    body: input.body,
    subreddit: input.subreddit,
    author: "test-user",
    publishedAt: new Date(),
    url: "https://www.reddit.com/r/test/comments/example/",
    sourceIds: ["test"],
    sourceKinds: ["relocation"],
  };
}
