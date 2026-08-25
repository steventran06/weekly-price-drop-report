import OpenAI from "openai";

import type {
  ExtractedMarketStats,
  MarketStats,
} from "./extractMarketStats.js";

import type {
  MarketStatsAnalysis,
} from "./analyzeMarketStats.js";

export interface GeneratedMarketStatsContent {
  blogTitle: string;
  blogDescription: string;

  blogIntroduction: string;

  competitiveMarketsIntro: string;
  buyerOpportunityIntro: string;
  condoMarketIntro: string;
  condoComparisonAnalysis: string;

  buyerTakeaways: string[];
  sellerTakeaways: string[];

  closing: string;

  reelScript: string;

  instagramCaption: string;

  googleBusinessPost: string;

  youtubeShortsTitle: string;
  youtubeShortsDescription: string;
  youtubeKeywords: string[];
}

export async function generateMarketStatsContent(
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
): Promise<GeneratedMarketStatsContent> {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing.",
    );
  }

  const client =
    new OpenAI({
      apiKey,
    });

  const model =
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5-mini";

  console.log("");
  console.log(
    `Generating market stats content with ${model}...`,
  );

  const marketData =
    stats.markets.map(
      (market) =>
        serializeMarket(market),
    );

  const response =
    await client.responses.create({
      model,
      store: false,

      instructions: `
You create weekly Portland Metro housing market content for
real estate broker Steven Tran.

You will receive structured housing-market statistics extracted
from a weekly TMO Reports PDF.

Your job is to write useful, consumer-facing commentary about
the Portland Metro real estate market.

GENERAL RULES:

- Use ONLY statistics supplied in the input.
- Never invent market statistics.
- Never invent historical comparisons.
- Never claim something increased or decreased unless prior-period
  comparison data is explicitly supplied.
- Do not use or mention sale-to-list ratio.
- Months of inventory, pending-to-active ratio and days on market
  are the primary market indicators.
- Clearly distinguish single-family and condominium markets.
- Do not claim a market is definitively a buyer's market or seller's
  market unless the supplied data clearly supports that conclusion.
- Prefer language such as:
  "more buyer leverage"
  "more competitive"
  "more inventory"
  "faster-moving"
  "slower-moving"
  "more choices"
  "less competition"
- Do not overstate causation.
- Keep the writing conversational, useful and direct.
- Avoid generic AI phrasing.
- Do not use long dashes, em dashes or en dashes.
- Use commas, periods, parentheses or colons instead.
- Never use the abbreviation "MOI".
- Always write "months of inventory".
- Do not write Markdown formatting.
- Do not use **bold** syntax.
- Do not add headings.
- Do not add tables.
- Do not add contact information.
- Do not add a relocation-guide CTA.
- Do not repeat every statistic that will already appear in a nearby
  table or stat block.
- Commentary should interpret the data rather than simply restating it.
- Never tell buyers to "target" a market because it moves quickly.
- Instead explain what buyers should expect if they are considering
  that area.
- Do not imply that faster-moving markets are automatically better.
- Do not imply that slower-moving markets are automatically worse.
- Do not tell buyers that they should waive inspections.
- Do not make guarantees about negotiation outcomes.

BLOG COPY:

Write:

1. A concise two-paragraph introduction explaining the broad Portland
   Metro picture.

2. A short introduction for the most competitive single-family section.
   Explain what the low inventory, pending activity and shorter days
   on market generally indicate.

3. A short introduction for the buyer-opportunity section.
   Explain why higher inventory and longer marketing times may create
   more flexibility.

4. A short introduction for the condo section.
   Explain that condos currently behave differently from detached homes
   in many parts of the metro.

5. A concise comparison paragraph interpreting the major condo versus
   single-family differences.

6. Three to five practical buyer takeaways.

7. Three to five practical seller takeaways.

8. A short closing emphasizing that Portland is not one housing market
   and buyers and sellers should look at their specific neighborhood,
   property type and price range.

The blog commentary should sound like an experienced local real estate
broker explaining the numbers to a client.

REEL:

Create a conversational 45 to 60 second Reel script.

Choose only the three to five most useful or surprising insights.

Do not try to mention every market.

Do not begin with:
"Hey Portland"
"Steven Tran here"
"Welcome back"
"This week we're looking at"

The hook should immediately communicate an interesting market insight.

Aim for approximately 125 to 165 words.

Make it sound natural when spoken aloud.

Avoid reading long lists of statistics.

Use statistics selectively to support the story.

End exactly with:

"Comment MARKET if you want the full breakdown, or call or text me and I’ll send you the details."

INSTAGRAM:

Write a useful caption summarizing the strongest market insights.

Use short paragraphs.

Make key numbers easy to understand.

Do not repeat the Reel word-for-word.

End with exactly these five hashtags:

#PortlandRealEstate #PortlandHousingMarket #PortlandMetro #BeavertonRealEstate #OregonRealEstate

GOOGLE BUSINESS PROFILE POST:

Write a standalone summary of the weekly market update that Steven can
copy and paste directly into a Google Business Profile post.

Rules:
- Maximum 1,500 characters INCLUDING spaces.
- Aim for approximately 1,050 to 1,350 characters so there is a safe margin.
- Use plain text only, with short readable paragraphs.
- No Markdown.
- No hashtags.
- No emojis.
- Summarize the most useful insights from the same market analysis used for
  the blog rather than trying to include every market.
- Include a useful mix of the broad Portland Metro picture and one or two
  notable submarket observations when supported by the supplied data.
- Make clear that conditions vary by area and property type.
- Do not invent week-over-week or year-over-year movement.
- Do not say that a market increased, decreased, rose or fell unless the
  input explicitly provides comparison data.
- End with this exact sentence:
  "Read the full Portland Metro market update at PortlandHomeGuide.com."

YOUTUBE:

Create:
- a concise YouTube Shorts title
- a useful Shorts description
- SEO keywords as an array

The title should feel timely and consistent enough to use every week.

Do not stuff the title with keywords.

Return valid JSON only.
`,

      input: `
REPORT DATE:
${analysis.reportDate ?? "Unknown"}

MARKET ANALYSIS:
${JSON.stringify(
  analysis,
  null,
  2,
)}

FULL MARKET DATA:
${JSON.stringify(
  marketData,
  null,
  2,
)}

Return exactly this JSON structure:

{
  "blogTitle": "string",
  "blogDescription": "string",
  "blogIntroduction": "string",
  "competitiveMarketsIntro": "string",
  "buyerOpportunityIntro": "string",
  "condoMarketIntro": "string",
  "condoComparisonAnalysis": "string",
  "buyerTakeaways": ["string"],
  "sellerTakeaways": ["string"],
  "closing": "string",
  "reelScript": "string",
  "instagramCaption": "string",
  "googleBusinessPost": "string",
  "youtubeShortsTitle": "string",
  "youtubeShortsDescription": "string",
  "youtubeKeywords": ["string"]
}
`,
    });

  const output =
    response.output_text.trim();

  if (!output) {
    throw new Error(
      "OpenAI returned empty market stats content.",
    );
  }

  const parsed =
    JSON.parse(
      output
        .replace(
          /^```(?:json)?\s*/i,
          "",
        )
        .replace(
          /\s*```$/i,
          "",
        )
        .trim(),
    ) as GeneratedMarketStatsContent;

  parsed.googleBusinessPost =
    enforceGoogleBusinessPostLimit(
      parsed.googleBusinessPost,
    );

  validateGeneratedContent(
    parsed,
  );

  return parsed;
}

function serializeMarket(
  market: MarketStats,
) {
  return {
    area:
      market.area,

    propertyType:
      market.propertyType,

    activeListings:
      market.activeListings,

    pendingListings:
      market.pendingListings,

    pendingActiveRatio:
      market.pendingActiveRatio,

    monthsOfInventory:
      market.monthsOfInventory,

    expiredListingsThreeMonths:
      market.expiredListingsThreeMonths,

    closedListingsThreeMonths:
      market.closedListingsThreeMonths,

    averageOriginalListPrice:
      market.averageOriginalListPrice,

    averageFinalListPrice:
      market.averageFinalListPrice,

    averageSalePrice:
      market.averageSalePrice,

    averageDaysOnMarketSold:
      market.averageDaysOnMarketSold,

    averageDaysOnMarketActive:
      market.averageDaysOnMarketActive,
  };
}

function validateGeneratedContent(
  content: GeneratedMarketStatsContent,
): void {
  const requiredStrings = [
    content.blogTitle,
    content.blogDescription,
    content.blogIntroduction,
    content.competitiveMarketsIntro,
    content.buyerOpportunityIntro,
    content.condoMarketIntro,
    content.condoComparisonAnalysis,
    content.closing,
    content.reelScript,
    content.instagramCaption,
    content.googleBusinessPost,
    content.youtubeShortsTitle,
    content.youtubeShortsDescription,
  ];

  if (
    requiredStrings.some(
      (value) =>
        typeof value !== "string" ||
        !value.trim(),
    )
  ) {
    throw new Error(
      "Generated market content is missing required text fields.",
    );
  }

  if (
    !Array.isArray(
      content.buyerTakeaways,
    ) ||
    content.buyerTakeaways.length < 3
  ) {
    throw new Error(
      "Generated buyer takeaways are invalid.",
    );
  }

  if (
    !Array.isArray(
      content.sellerTakeaways,
    ) ||
    content.sellerTakeaways.length < 3
  ) {
    throw new Error(
      "Generated seller takeaways are invalid.",
    );
  }

  if (
    !Array.isArray(
      content.youtubeKeywords,
    ) ||
    content.youtubeKeywords.length === 0
  ) {
    throw new Error(
      "Generated YouTube keywords are invalid.",
    );
  }

  const reelWordCount =
    content.reelScript
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;

  if (
    reelWordCount < 110 ||
    reelWordCount > 185
  ) {
    console.warn(
      `Generated Reel script has ${reelWordCount} words.`,
    );
  }
}


function enforceGoogleBusinessPostLimit(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  const cta =
    "Read the full Portland Metro market update at PortlandHomeGuide.com.";

  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const body = normalized
    .replace(
      new RegExp(
        `${escapeRegExp(cta)}\\s*$`,
        "i",
      ),
      "",
    )
    .trim();

  const separator = "\n\n";
  const maxCharacters = 1_500;
  const maxBodyCharacters =
    maxCharacters -
    separator.length -
    cta.length;

  const trimmedBody =
    truncateTextAtBoundary(
      body,
      maxBodyCharacters,
    );

  return [
    trimmedBody,
    cta,
  ]
    .filter(Boolean)
    .join(separator)
    .slice(0, maxCharacters);
}

function truncateTextAtBoundary(
  value: string,
  maxCharacters: number,
): string {
  if (value.length <= maxCharacters) {
    return value;
  }

  const candidate =
    value.slice(0, maxCharacters);

  const sentenceBreak = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
    candidate.lastIndexOf("\n"),
  );

  if (sentenceBreak >= 700) {
    return candidate
      .slice(0, sentenceBreak + 1)
      .trimEnd();
  }

  const lastSpace =
    candidate.lastIndexOf(" ");

  return candidate
    .slice(
      0,
      lastSpace > 0
        ? lastSpace
        : maxCharacters,
    )
    .trimEnd();
}

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}
