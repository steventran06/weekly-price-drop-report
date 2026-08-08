import OpenAI from "openai";

import type {
  MonthlyMarketAnalysis,
  MonthlyMarketTrend,
} from "./analyzeMonthlyMarketStats.js";

import type {
  MonthlyPriceDropAnalysis,
} from "./analyzeMonthlyPriceDrops.js";

export interface GeneratedMonthlyBuyerContent {
  /*
   * Blog content.
   */
  description: string;

  introduction: string;

  buyerLeverageIntro: string;

  competitiveMarketsIntro: string;

  condoIntro: string;

  trendAnalysis: string;

  priceDropIntro:
    string | null;

  buyerTakeaways:
    string[];

  watchNextMonth:
    string[];

  closing: string;

  /*
   * Social content package.
   */
  reelScript: string;

  reelCaption: string;

  youtubeShortsTitle: string;

  youtubeShortsDescription: string;

  youtubeKeywords: string;

  instagramStory: string;

  facebookPost: string;
}

export async function generateMonthlyBuyerContent(
  analysis:
    MonthlyMarketAnalysis,

  priceDrops:
    MonthlyPriceDropAnalysis,
): Promise<GeneratedMonthlyBuyerContent> {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (
    !apiKey
  ) {
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
    `Generating ${analysis.monthName} monthly housing content with ${model}...`,
  );

  const hasPriceDropData =
    priceDrops.snapshotCount >
      0 &&
    priceDrops.uniqueListings >
      0;

  const currentMonth =
    getFollowingMonth(
      analysis.year,
      analysis.month,
    );

  const response =
    await client.responses.create({
      model,

      store:
        false,

      instructions: `
You are creating a monthly Portland Metro housing market content
package for real estate broker Steven Tran.

PURPOSE

This content looks BACK at the previous month's housing activity
and uses those numbers to identify things buyers should watch during
the CURRENT month.

For example:

If the data is from July and the content is being published in August,
the framing should be:

"Let's look back at what happened in July and what those numbers
could mean for buyers heading into August."

Never make the previous month's data sound like current-month data.

The audience is a normal homebuyer, not a real estate professional.

The application separately handles:

- article title
- article headings
- Markdown formatting
- market tables
- price-drop tables
- disclosures
- public blog URL

You are generating:

1. Supporting blog copy
2. Reel / Shorts script
3. Instagram / Facebook Reel caption
4. YouTube Shorts title
5. YouTube Shorts description
6. YouTube keywords
7. Instagram Story copy
8. Facebook post

DATA ACCURACY

- Use only the supplied data.
- Never invent statistics.
- Never invent markets.
- Never invent price reductions.
- Never invent trends.
- Never imply correlation proves causation.
- Never describe two weekly reports as a complete monthly trend.
- Never use "month-over-month" unless actual prior-month data exists.
- Do not overstate small changes.
- Prefer a few meaningful statistics instead of listing every number.
- If fewer than four weekly reports are available, acknowledge this
  once in the BLOG introduction.
- Do not repeatedly mention incomplete data in social content.

CONSUMER LANGUAGE

Avoid technical real-estate terminology in public-facing copy.

Do not use:

- months of inventory
- months-of-inventory
- pending-to-active ratio
- pending ratio
- absorption rate
- micromarket
- supply-demand ratio
- active-to-pending ratio
- market velocity
- market absorption
- sold DOM
- DOM

Instead use plain language such as:

- more homes were available
- fewer homes were available
- homes were taking longer to sell
- homes were selling faster
- buyer activity increased
- buyer activity slowed
- buyers had more time
- buyers had more choices
- buyers may have had more negotiating room
- competition remained stronger

You MAY use understandable statistics such as:

- active listings
- average days to sell
- average sale price
- number of price reductions
- typical dollar reduction
- percentage reduction

Use numbers when they help tell the story.

PRICE-DROP LANGUAGE

If price-drop data exists:

- Treat each unique property as one listing even if it appeared in
  multiple weekly reports.
- totalPriceReduction is the difference between original list price
  and latest tracked price.
- Do not imply a price reduction means seller distress.
- Do not call a property a bargain.
- Do not claim a property is under market value.
- Price reductions may indicate seller motivation, but they can also
  mean an original price was not supported by the market.
- Use "typical reduction" when discussing medianReduction.
- Focus on what the pattern may mean for buyers.

BUYER SAFETY

Never tell buyers to:

- waive inspections
- waive appraisal protections
- waive financing protections
- waive contingencies
- remove contingencies
- reduce contingencies
- give up contractual protections

In competitive markets, simply explain that buyers may need to be
prepared to make decisions more quickly.

STYLE

Steven should sound like a knowledgeable Portland-area real estate
broker explaining the market to a client.

Write:

- direct
- practical
- conversational
- locally focused
- consumer-friendly
- confident without exaggeration

Avoid phrases such as:

- navigate the market
- dynamic market
- ever-changing market
- dream home
- exciting opportunity
- unique landscape
- market landscape
- whether you're buying or selling
- here's the thing
- here's what you need to know

Do not use em dashes or en dashes.

BLOG CONTENT

1. description

Write a concise SEO description explaining that the article looks
back at the previous month's Portland Metro housing activity and
identifies what buyers should watch during the current month.

2. introduction

Write two short paragraphs.

Explain:

- this is a look back at the previous month
- the goal is to identify signals that may matter this month
- how many weekly market snapshots were available
- the broadest takeaway

Do not list every market.

3. buyerLeverageIntro

Write one short paragraph introducing areas where buyers had more
time, more homes to consider or potentially more negotiating room.

4. competitiveMarketsIntro

Write one short paragraph introducing areas where homes were moving
faster and buyers had less time.

5. condoIntro

Write one or two short paragraphs explaining practical differences
between condo and detached-home markets.

6. trendAnalysis

Write one to three short paragraphs discussing only meaningful changes
between the available weekly snapshots.

Use plain English.

Do not repeat every statistic.

7. priceDropIntro

If PRICE DROP DATA AVAILABLE is false:

Return null.

If true:

Write one or two short paragraphs explaining what the month's
price reductions may suggest.

Mention:

- number of unique properties tracked
- typical reduction if available
- reductions can indicate seller motivation
- a reduction does not automatically mean a home is a deal

Do not list individual properties.

8. buyerTakeaways

Return 3 to 4 practical takeaways for someone shopping during
the current month.

9. watchNextMonth

Return exactly 3 short items describing what Steven should watch
during the current month based on the prior month's data.

10. closing

Write one short paragraph explaining that Portland Metro is made up
of many different local markets and opportunities depend on location,
property type, condition and price range.

SOCIAL CONTENT

11. reelScript

Write a spoken script for Instagram Reels, Facebook Reels and
YouTube Shorts.

STRICT REQUIREMENTS:

- Maximum 180 words.
- Target approximately 140 to 175 words.
- Must comfortably fit in 90 seconds.
- No stage directions.
- No headings.
- No hashtags.
- No URL.
- Do not introduce Steven by name.
- Write exactly how Steven can say it on camera.
- Use approximately 3 to 5 meaningful statistics or observations.
- Explain why those numbers matter.
- Do not simply list numbers.

The opening should immediately establish the lookback.

For example:

"Let's look back at what happened in the Portland Metro housing
market in July and what those numbers could mean for buyers
heading into August."

You may improve that wording.

If meaningful price-drop data exists, mention it.

End by telling viewers the full breakdown is available at
steventranrealestate.com.

12. reelCaption

Write a ready-to-post Instagram and Facebook Reel caption.

Requirements:

- 80 to 150 words
- frame it as a previous-month lookback
- explain what Steven is watching this month
- include 1 to 3 useful statistics when appropriate
- use paragraph breaks
- a few emojis are okay
- do not use the full blog URL
- end by saying the full report is at steventranrealestate.com
- include a small group of relevant hashtags
- no em dashes or en dashes

13. youtubeShortsTitle

Write one YouTube Shorts title.

Requirements:

- ideally under 70 characters
- maximum 100 characters
- include Portland or Portland Metro
- reflect either the previous-month lookback or what it means this month
- no clickbait
- no URL

14. youtubeShortsDescription

Write a short YouTube Shorts description.

Requirements:

- 2 to 4 short paragraphs
- say this is a look back at the previous month's numbers
- explain what buyers should watch this month
- mention one or two meaningful findings when useful
- finish with this exact placeholder on its own line:

{{BLOG_URL}}

Do not invent a URL.

15. youtubeKeywords

Return one comma-separated string.

Requirements:

- no hashtags
- under 450 characters
- focus on Portland Metro real estate and homebuyer search intent
- include specific cities or areas only if supported by the report
- avoid keyword stuffing

16. instagramStory

Write short Instagram Story copy.

Requirements:

- 30 to 65 words
- frame it as a previous-month lookback
- mention one interesting takeaway when useful
- say the full breakdown is at steventranrealestate.com
- maximum 2 emojis
- no hashtags

17. facebookPost

Write a ready-to-post Facebook post promoting the monthly market
lookback.

Requirements:

- 100 to 180 words
- conversational and natural
- frame it as looking back at the previous month's Portland Metro data
- explain what those numbers may mean for buyers this month
- mention approximately 2 to 4 interesting findings
- consumer-friendly language
- do not overload the post with statistics
- do not simply duplicate the Reel caption
- a few emojis are okay
- encourage readers to read the complete report
- finish with this exact placeholder on its own line:

{{BLOG_URL}}

Do not invent a URL.

Return valid JSON only.
`,

      input: `
PREVIOUS MONTH:
${analysis.monthName} ${analysis.year}

CURRENT MONTH:
${currentMonth.monthName} ${currentMonth.year}

WEEKLY MARKET REPORTS AVAILABLE:
${analysis.reportsAvailable}

MARKET SNAPSHOT DATES:
${analysis.snapshotDates.join(", ")}

PRICE DROP DATA AVAILABLE:
${hasPriceDropData}

MONTHLY MARKET ANALYSIS:
${JSON.stringify(
  serializeMarketAnalysis(
    analysis,
  ),
  null,
  2,
)}

MONTHLY PRICE DROP ANALYSIS:
${JSON.stringify(
  serializePriceDropAnalysis(
    priceDrops,
  ),
  null,
  2,
)}

Return exactly this JSON structure:

{
  "description": "string",
  "introduction": "string",
  "buyerLeverageIntro": "string",
  "competitiveMarketsIntro": "string",
  "condoIntro": "string",
  "trendAnalysis": "string",
  "priceDropIntro": "string or null",
  "buyerTakeaways": [
    "string"
  ],
  "watchNextMonth": [
    "string",
    "string",
    "string"
  ],
  "closing": "string",
  "reelScript": "string",
  "reelCaption": "string",
  "youtubeShortsTitle": "string",
  "youtubeShortsDescription": "string",
  "youtubeKeywords": "string",
  "instagramStory": "string",
  "facebookPost": "string"
}
`,
    });

  const output =
    response.output_text
      .trim();

  if (
    !output
  ) {
    throw new Error(
      "OpenAI returned empty monthly buyer content.",
    );
  }

  const cleanedOutput =
    output
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/i,
        "",
      )
      .trim();

  let parsed:
    GeneratedMonthlyBuyerContent;

  try {
    parsed =
      JSON.parse(
        cleanedOutput,
      ) as GeneratedMonthlyBuyerContent;
  } catch (
    error
  ) {
    console.error("");
    console.error(
      "OpenAI returned invalid JSON:",
    );

    console.error(
      cleanedOutput,
    );

    throw error;
  }

  validateGeneratedContent(
    parsed,
    hasPriceDropData,
  );

  return parsed;
}

function serializeMarketAnalysis(
  analysis:
    MonthlyMarketAnalysis,
) {
  return {
    reportsAvailable:
      analysis.reportsAvailable,

    snapshotDates:
      analysis.snapshotDates,

    markets:
      analysis.markets.map(
        serializeMarket,
      ),

    highestEndingSingleFamilyInventory:
      analysis
        .highestEndingSingleFamilyInventory
        .map(
          serializeMarket,
        ),

    lowestEndingSingleFamilyInventory:
      analysis
        .lowestEndingSingleFamilyInventory
        .map(
          serializeMarket,
        ),

    largestSingleFamilyInventoryIncreases:
      analysis
        .largestSingleFamilyInventoryIncreases
        .map(
          serializeMarket,
        ),

    largestSingleFamilyInventoryDecreases:
      analysis
        .largestSingleFamilyInventoryDecreases
        .map(
          serializeMarket,
        ),

    longestSingleFamilySoldDom:
      analysis
        .longestSingleFamilySoldDom
        .map(
          serializeMarket,
        ),

    shortestSingleFamilySoldDom:
      analysis
        .shortestSingleFamilySoldDom
        .map(
          serializeMarket,
        ),

    highestEndingCondoInventory:
      analysis
        .highestEndingCondoInventory
        .map(
          serializeMarket,
        ),
  };
}

function serializeMarket(
  market:
    MonthlyMarketTrend,
) {
  return {
    area:
      market.area,

    propertyType:
      market.propertyType,

    startingActiveListings:
      market.startingActiveListings,

    endingActiveListings:
      market.endingActiveListings,

    activeListingsChange:
      market.activeListingsChange,

    startingSoldDom:
      market.startingSoldDom,

    endingSoldDom:
      market.endingSoldDom,

    soldDomChange:
      market.soldDomChange,

    startingAverageSalePrice:
      market.startingAverageSalePrice,

    endingAverageSalePrice:
      market.endingAverageSalePrice,

    averageSalePrice:
      market.averageSalePrice,

    startingInventory:
      market.startingInventory,

    endingInventory:
      market.endingInventory,

    inventoryChange:
      market.inventoryChange,

    startingPendingRatio:
      market.startingPendingRatio,

    endingPendingRatio:
      market.endingPendingRatio,

    pendingRatioChange:
      market.pendingRatioChange,
  };
}

function serializePriceDropAnalysis(
  analysis:
    MonthlyPriceDropAnalysis,
) {
  return {
    snapshotCount:
      analysis.snapshotCount,

    snapshotDates:
      analysis.snapshotDates,

    uniqueListings:
      analysis.uniqueListings,

    listingsWithKnownReduction:
      analysis.listingsWithKnownReduction,

    medianReduction:
      analysis.medianReduction,

    averageReduction:
      analysis.averageReduction,

    medianReductionPercent:
      analysis.medianReductionPercent,

    averageReductionPercent:
      analysis.averageReductionPercent,

    largestReduction:
      analysis.largestReduction,

    largestReductionPercent:
      analysis.largestReductionPercent,

    areasWithMostPriceDrops:
      analysis
        .areasWithMostPriceDrops
        .slice(
          0,
          5,
        )
        .map(
          (area) => ({
            area:
              area.area,

            uniqueListings:
              area.uniqueListings,

            medianReduction:
              area.medianReduction,

            medianReductionPercent:
              area.medianReductionPercent,

            largestReduction:
              area.largestReduction,
          }),
        ),
  };
}

function getFollowingMonth(
  year: number,
  month: number,
): {
  year: number;
  monthName: string;
} {
  const date =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    );

  return {
    year:
      date.getUTCFullYear(),

    monthName:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",

          timeZone:
            "UTC",
        },
      ).format(
        date,
      ),
  };
}

function validateGeneratedContent(
  generated:
    GeneratedMonthlyBuyerContent,

  hasPriceDropData:
    boolean,
): void {
  const requiredStrings = [
    generated.description,
    generated.introduction,
    generated.buyerLeverageIntro,
    generated.competitiveMarketsIntro,
    generated.condoIntro,
    generated.trendAnalysis,
    generated.closing,
    generated.reelScript,
    generated.reelCaption,
    generated.youtubeShortsTitle,
    generated.youtubeShortsDescription,
    generated.youtubeKeywords,
    generated.instagramStory,
    generated.facebookPost,
  ];

  if (
    requiredStrings.some(
      (value) =>
        typeof value !==
          "string" ||
        !value.trim(),
    )
  ) {
    throw new Error(
      "Generated monthly buyer content is missing required text.",
    );
  }

  if (
    hasPriceDropData
  ) {
    if (
      typeof generated.priceDropIntro !==
        "string" ||
      !generated.priceDropIntro.trim()
    ) {
      throw new Error(
        "Generated monthly content is missing price-drop analysis.",
      );
    }
  } else {
    generated.priceDropIntro =
      null;
  }

  if (
    !Array.isArray(
      generated.buyerTakeaways,
    ) ||
    generated.buyerTakeaways.length <
      3 ||
    generated.buyerTakeaways.length >
      4
  ) {
    throw new Error(
      "Buyer takeaways must contain 3 to 4 items.",
    );
  }

  if (
    !Array.isArray(
      generated.watchNextMonth,
    ) ||
    generated.watchNextMonth.length !==
      3
  ) {
    throw new Error(
      "Watch-next-month must contain exactly 3 items.",
    );
  }

  const reelWordCount =
    countWords(
      generated.reelScript,
    );

  if (
    reelWordCount >
    180
  ) {
    throw new Error(
      `Reel script is too long: ${reelWordCount} words. Maximum is 180.`,
    );
  }

  if (
    reelWordCount <
    90
  ) {
    console.warn(
      `Reel script is only ${reelWordCount} words.`,
    );
  }

  if (
    generated.youtubeShortsTitle.length >
    100
  ) {
    throw new Error(
      "YouTube Shorts title is longer than 100 characters.",
    );
  }

  if (
    generated.youtubeKeywords.length >
    450
  ) {
    throw new Error(
      "YouTube keywords exceed 450 characters.",
    );
  }

  if (
    !generated.youtubeShortsDescription.includes(
      "{{BLOG_URL}}",
    )
  ) {
    throw new Error(
      "YouTube Shorts description is missing {{BLOG_URL}}.",
    );
  }

  if (
    !generated.facebookPost.includes(
      "{{BLOG_URL}}",
    )
  ) {
    throw new Error(
      "Facebook post is missing {{BLOG_URL}}.",
    );
  }

  const publicText = [
    generated.description,
    generated.introduction,
    generated.buyerLeverageIntro,
    generated.competitiveMarketsIntro,
    generated.condoIntro,
    generated.trendAnalysis,
    generated.priceDropIntro ??
      "",
    ...generated.buyerTakeaways,
    ...generated.watchNextMonth,
    generated.closing,
    generated.reelScript,
    generated.reelCaption,
    generated.youtubeShortsTitle,
    generated.youtubeShortsDescription,
    generated.instagramStory,
    generated.facebookPost,
  ]
    .join(
      " ",
    )
    .toLowerCase();

  const forbiddenTerms = [
    "months of inventory",
    "months-of-inventory",
    "pending-to-active",
    "pending ratio",
    "absorption rate",
    "micromarket",
    "sold dom",
  ];

  for (
    const term
    of forbiddenTerms
  ) {
    if (
      publicText.includes(
        term,
      )
    ) {
      throw new Error(
        `Generated monthly buyer content contains jargon: "${term}".`,
      );
    }
  }

  /*
   * Buyer-safety validation.
   *
   * Only flag language that actually encourages
   * giving up buyer protections.
   *
   * Do NOT flag safe language such as:
   *
   * "don't waive inspections"
   * "never waive inspections"
   * "without waiving inspections"
   */
  const unsafeBuyerPatterns: RegExp[] = [
    /\byou should waive (?:an? )?inspection/i,

    /\bconsider waiving (?:an? )?inspection/i,

    /\bconsider waiving inspections/i,

    /\bbe willing to waive (?:an? )?inspection/i,

    /\bbe willing to waive inspections/i,

    /\bwaive (?:an? )?inspection to (?:win|compete|strengthen)/i,

    /\bwaive inspections to (?:win|compete|strengthen)/i,

    /\byou should waive (?:the )?appraisal/i,

    /\bconsider waiving (?:the )?appraisal/i,

    /\bbe willing to waive (?:the )?appraisal/i,

    /\byou should waive (?:your )?financing contingency/i,

    /\bconsider waiving (?:your )?financing contingency/i,

    /\bbe willing to waive (?:your )?financing contingency/i,

    /\byou should remove contingencies/i,

    /\bconsider removing contingencies/i,

    /\breduce contingencies to (?:win|compete|strengthen)/i,

    /\bfewer contingencies (?:can|will|may) make/i,

    /\bgive up (?:your )?(?:inspection|appraisal|financing) protections/i,
  ];

  for (
    const pattern
    of unsafeBuyerPatterns
  ) {
    if (
      pattern.test(
        publicText,
      )
    ) {
      throw new Error(
        `Generated content contains prohibited buyer advice matching: ${pattern}`,
      );
    }
  }
}

function countWords(
  value: string,
): number {
  return value
    .trim()
    .split(
      /\s+/,
    )
    .filter(
      Boolean,
    )
    .length;
}