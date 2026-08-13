import {
  findCityMatches,
} from "./cities.js";
import {
  getSubredditContext,
} from "./subreddits.js";
import type {
  RedditPost,
  RelevanceResult,
} from "./types.js";

const BUYER_PATTERNS = [
  /\bbuy(?:ing)?\b/i,
  /\bhomebuyer\b/i,
  /\bfirst[- ]time buyer\b/i,
  /\bhouse hunting\b/i,
  /\bhome search\b/i,
  /\blooking to buy\b/i,
  /\bwants? to buy\b/i,
  /\bmortgage\b/i,
  /\bpre[- ]?approval\b/i,
  /\bdown payment\b/i,
  /\bnew construction\b/i,
  /\bnew build\b/i,
  /\binvestment propert(?:y|ies)\b/i,
  /\breal estate invest(?:or|ing|ment)\b/i,
];

const MOVING_PATTERNS = [
  /\bmoving\b/i,
  /\bmove to\b/i,
  /\bmoving to\b/i,
  /\brelocat(?:e|ing|ion)\b/i,
  /\bthinking (?:about|of) moving\b/i,
  /\bconsidering (?:a )?move\b/i,
  /\bconsidering (?:moving|relocating)\b/i,
  /\bplanning (?:a )?move\b/i,
  /\blooking to move\b/i,
  /\bwhere should (?:i|we) live\b/i,
  /\bwhere should (?:i|we) move\b/i,
  /\bdeciding between\b/i,
  /\bchoosing between\b/i,
  /\bjob offer\b/i,
  /\bstarting (?:a )?(?:new )?job\b/i,
  /\btransferr?ing\b/i,
];

const RENTAL_PATTERNS = [
  /\brent(?:ing|al|als)?\b/i,
  /\bapartment(?:s)?\b/i,
  /\b(?:lease|leasing)\b/i,
  /\broommate(?:s)?\b/i,
  /\broom for rent\b/i,
  /\bsublet\b/i,
  /\btenant\b/i,
];

const SELLER_PATTERNS = [
  /\bsell(?:ing)? (?:my|our) (?:home|house|property)\b/i,
  /\blisting (?:my|our) (?:home|house|property)\b/i,
  /\blisting agent\b/i,
  /\bseller agent\b/i,
];

const QUESTION_PATTERNS = [
  /\blooking for\b/i,
  /\brecommend(?:ation|ations|ed)?\b/i,
  /\badvice\b/i,
  /\bhelp\b/i,
  /\bshould (?:i|we)\b/i,
  /\bwhere (?:should|would|can)\b/i,
  /\bwhich (?:area|city|neighborhood|suburb)\b/i,
  /\bhow is\b/i,
  /\bdoes anyone\b/i,
  /\banyone (?:have|know|recommend)\b/i,
  /\bworth (?:moving|buying|considering)\b/i,
];

const RETROSPECTIVE_PATTERNS = [
  /\bmoved away\b/i,
  /\bleft (?:portland|oregon|washington|vancouver)\b/i,
  /\bused to live\b/i,
  /\bwhen i lived\b/i,
  /\bwhen we lived\b/i,
  /\bi lived there\b/i,
  /\bwe lived there\b/i,
];

const FIRST_PERSON_PATTERNS = [
  /\bI\b/,
  /\bI'm\b/i,
  /\bI've\b/i,
  /\bmy\b/i,
  /\bwe\b/i,
  /\bwe're\b/i,
  /\bour\b/i,
];

export function evaluateRelevance(
  post: RedditPost,
): RelevanceResult {
  const text = [
    post.title,
    post.body,
  ].join("\n");

  const cities = findCityMatches(
    text,
    post.subreddit,
  );

  const subredditContext =
    getSubredditContext(post.subreddit);

  const hasBuyerIntent = matchesAny(
    text,
    BUYER_PATTERNS,
  );

  const hasMovingIntent = matchesAny(
    text,
    MOVING_PATTERNS,
  );

  const hasRentalIntent = matchesAny(
    text,
    RENTAL_PATTERNS,
  );

  const isRetrospective = matchesAny(
    text,
    RETROSPECTIVE_PATTERNS,
  );

  const hasSellerIntent = matchesAny(
    text,
    SELLER_PATTERNS,
  );

  const hasQuestionSignal = matchesAny(
    text,
    QUESTION_PATTERNS,
  );

  const isFirstPerson = matchesAny(
    text,
    FIRST_PERSON_PATTERNS,
  );

  let score = 0;
  const reasons: string[] = [];

  if (cities.length > 0) {
    score += 4;
    reasons.push(
      `city: ${cities.map((city) => city.name).join(", ")}`,
    );
  }

  if (hasBuyerIntent) {
    score += 4;
    reasons.push("buyer intent");
  }

  if (hasMovingIntent) {
    score += 3;
    reasons.push("moving/relocation intent");
  }

  if (isFirstPerson) {
    score += 1;
    reasons.push("first-person post");
  }

  if (hasQuestionSignal) {
    score += 1;
    reasons.push("advice/question signal");
  }

  if (subredditContext === "relocation") {
    score += 2;
    reasons.push("relocation subreddit");
  }

  if (subredditContext === "living") {
    score += 2;
    reasons.push("living-comparison subreddit");
  }

  if (subredditContext === "buyer") {
    score += 2;
    reasons.push("homebuyer/real-estate subreddit");
  }

  if (subredditContext === "local") {
    score += 1;
    reasons.push("local subreddit");
  }

  if (
    hasRentalIntent &&
    !hasBuyerIntent
  ) {
    return {
      relevant: false,
      score,
      reasons: [
        ...reasons,
        "excluded: rental intent without buyer intent",
      ],
      cities,
      hasBuyerIntent,
      hasMovingIntent,
      hasRentalIntent,
    };
  }

  if (
    hasSellerIntent &&
    !hasBuyerIntent &&
    !hasMovingIntent
  ) {
    return {
      relevant: false,
      score,
      reasons: [
        ...reasons,
        "excluded: seller-only intent",
      ],
      cities,
      hasBuyerIntent,
      hasMovingIntent,
      hasRentalIntent,
    };
  }

  if (
    isRetrospective &&
    !hasBuyerIntent &&
    !hasMovingIntent
  ) {
    return {
      relevant: false,
      score,
      reasons: [
        ...reasons,
        "excluded: retrospective discussion",
      ],
      cities,
      hasBuyerIntent,
      hasMovingIntent,
      hasRentalIntent,
    };
  }

  const hasLeadSignal =
    isFirstPerson ||
    hasQuestionSignal ||
    hasMovingIntent ||
    subredditContext === "relocation" ||
    subredditContext === "living";

  const relevant =
    cities.length > 0 &&
    score >= 7 &&
    hasLeadSignal &&
    (
      hasBuyerIntent ||
      hasMovingIntent ||
      subredditContext === "relocation" ||
      subredditContext === "living" ||
      subredditContext === "buyer"
    );

  return {
    relevant,
    score,
    reasons,
    cities,
    hasBuyerIntent,
    hasMovingIntent,
    hasRentalIntent,
  };
}

function matchesAny(
  text: string,
  patterns: RegExp[],
): boolean {
  return patterns.some(
    (pattern) => pattern.test(text),
  );
}
