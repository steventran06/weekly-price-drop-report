import {
  createOpenAIClient,
  getOpenAIModel,
} from "./openaiClient.js";
import { parseOpenAIJson } from "./json.js";
import type { SelectedListing } from "./types.js";

interface GeneratedCopy {
  reelIntro: string;
  reelListingLines: Record<string, string>;
  instagramIntro: string;
  instagramClosing: string;
  youtubeIntro: string;
  youtubeClosing: string;
  youtubeKeywords: string;
  factCheckNotes: string[];
}

export interface GeneratedContent {
  reelScript: string;
  instagramCaption: string;
  youtubeShortsDescription: string;
  youtubeKeywords: string;
  factCheckNotes: string[];
}

const INSTAGRAM_HASHTAGS =
  "#PortlandRealEstate #PortlandMetro #BeavertonRealEstate #HomesForSale #PriceDrop";

const CONTACT_BLOCK = `Connect With Me
📞 Call / Text: (971) 285-2002
📧 Email: steven@diverserg.com
Instagram: https://instagram.com/steventranpdx
Facebook: https://www.facebook.com/StevenTranPDXRealtor/

📅 Schedule a call with me here:
👉 https://calendly.com/steven-diverserg/new-meeting`;

const EXACT_REEL_CTA =
  "Comment price drop if any of these homes interest you, or you can call or text me, and I’ll send you the details.";

export async function generateContent(
  selectedListings: SelectedListing[],
): Promise<GeneratedContent> {
  if (
    selectedListings.length < 4 ||
    selectedListings.length > 5
  ) {
    throw new Error(
      "Content generation requires 4 or 5 selected listings.",
    );
  }

  const client = createOpenAIClient();
  const model = getOpenAIModel();

  const rankedListings = [...selectedListings].sort(
    (a, b) => a.rank - b.rank,
  );

  const contentInput = rankedListings.map(
    (listing) => ({
      rank: listing.rank,
      mlsNumber: listing.mlsNumber,
      fullAddress: listing.address,
      locationLabel: createLocationLabel(listing),
      currentPrice: listing.currentPrice,
      formattedCurrentPrice: formatCurrency(
        listing.currentPrice,
      ),
      originalPrice: listing.originalPrice,
      formattedOriginalPrice:
        listing.originalPrice !== null
          ? formatCurrency(listing.originalPrice)
          : null,
      totalPriceReduction:
        listing.totalPriceReduction,
      roundedReductionText:
        formatRoundedReduction(
          listing.totalPriceReduction,
        ),
      shortReason: listing.shortReason,
      spokenLine: listing.spokenLine,
    }),
  );

  console.log(
    `Generating content for ${rankedListings.length} selected listing(s)...`,
  );

  const response = await client.responses.create({
    model,
    store: false,
    instructions: `
You are writing content for Steven Tran's recurring Portland Metro
Price Alert video series.

Steven is a Portland-area real estate broker. His voice is direct,
casual, knowledgeable and conversational. He should sound like he is
quickly explaining interesting homes to a viewer, not reading an MLS
report or delivering a formal advertisement.

You may use ONLY the supplied listings.

Important:
- The application adds full addresses to Instagram and YouTube itself.
- Do not recreate complete property lists.
- Do not include MLS numbers in public-facing copy.
- Do not mention internal fact-checking language.
- Do not mention concerns in public-facing content.
- Do not use phrases such as "dream home," "incredible deal,"
  "won't last," "perfect," "huge family value," or "no fluff."
- Do not use long dashes.
- Do not invent features, locations, schools or neighborhood claims.
- Keep the same ranked order as the input.

Reel:
- Keep the opening under 15 words.
- Keep each property line between 18 and 25 words.
- Mention no more than two property features per home.
- Avoid repeating both the price and reduction in multiple ways.
- The assembled script must stay under 180 words including the CTA.
- Write one brief, conversational opening hook.
- Do not open with "Portland Metro price alerts."
- Good opening examples:
  "I went through this week's Portland Metro price drops, and these five stood out."
  "Here are five Portland Metro price drops worth taking a closer look at this week."
- Write one natural spoken sentence for each property.
- Do not say or read any street address.
- Do not include street numbers.
- Refer to each property using its locationLabel, city, neighborhood,
  architectural style or most distinctive feature.
- The full script should flow like one connected conversation.
- Use transitions such as:
  "First up,"
  "Another one that stood out,"
  "Over in..."
  "You also have..."
  "And the last one..."
- Do not write five disconnected property-summary fragments.
- Use complete sentences with natural verbs.
- Avoid repeatedly using the structure:
  "A home in [location] for [price], [features]."
- Include formattedCurrentPrice naturally.
- Include roundedReductionText naturally when available.
- If no valid reduction is supplied, omit the reduction.
- Highlight one or two strong property details.
- Vary transitions and sentence structure.
- Do not number the properties aloud.
- Do not begin every property with "Next."
- The final assembled Reel should be approximately 125 to 165 words.
- Do not write the final CTA. The application adds it exactly.

Instagram:
- Write only a brief hook before the property list.
- Write only a brief CTA after the property list.
- Do not generate the actual property list.
- Do not generate hashtags.
- Keep it casual, useful and easy to scan.

YouTube Shorts:
- Write only a short introduction before the property list.
- Write only a short closing CTA after the property list.
- Do not generate the actual property list.
- Do not generate the contact block.
- Explain that these are selected Portland Metro listings with
  noteworthy reductions from their original list prices.

Keywords:
- Return one comma-separated keyword string.
- Include spaces after commas.
- Include Portland Metro real estate, price drops, featured cities,
  supported neighborhoods and buyer search terms.
- Do not include hashtags.

Return valid JSON only.
`,
    input: `
Create copy using only these selected listings:

${JSON.stringify(contentInput, null, 2)}

Return JSON matching this exact structure:

{
  "reelIntro": "string",
  "reelListingLines": {
    "MLS_NUMBER_1": "string",
    "MLS_NUMBER_2": "string"
  },
  "instagramIntro": "string",
  "instagramClosing": "string",
  "youtubeIntro": "string",
  "youtubeClosing": "string",
  "youtubeKeywords": "string",
  "factCheckNotes": [
    "string"
  ]
}

Requirements:
- reelListingLines must contain exactly one entry for every supplied MLS number.
- Use the MLS number only as the JSON object key.
- Every Reel property line must describe the matching listing using its
  locationLabel and supported property details.
- Every Reel property line must include formattedCurrentPrice.
- Do not include the street address or street number in any Reel line.
- Mention roundedReductionText when available.
- If roundedReductionText is null, omit price-reduction wording.
- Every Reel property line must be a complete spoken sentence.
- Each line should connect naturally to the previous line.
- Use a conversational transition in at least three property lines.
- Do not return noun fragments or comma-heavy property summaries.
- Avoid repeating the same sentence structure across the listings.
- Do not include the final Reel CTA.
- Do not include property lists in Instagram or YouTube intro/closing fields.
- Keep factCheckNotes internal and concise.
- Do not include fields outside this structure.
`,
  });

  const generatedCopy =
    parseOpenAIJson<GeneratedCopy>(
      response.output_text,
      "content",
    );

  validateGeneratedCopy(
    generatedCopy,
    rankedListings,
  );

  const reelScript = buildReelScript(
    generatedCopy,
    rankedListings,
  );

  const instagramCaption =
    buildInstagramCaption(
      generatedCopy,
      rankedListings,
    );

  const youtubeShortsDescription =
    buildYoutubeDescription(
      generatedCopy,
      rankedListings,
    );

  const youtubeKeywords =
    normalizeKeywords(
      generatedCopy.youtubeKeywords,
    );

  const content: GeneratedContent = {
    reelScript,
    instagramCaption,
    youtubeShortsDescription,
    youtubeKeywords,
    factCheckNotes:
      generatedCopy.factCheckNotes ?? [],
  };

  validateFinalContent(
    content,
    rankedListings,
  );

  return content;
}

function buildReelScript(
  copy: GeneratedCopy,
  listings: SelectedListing[],
): string {
  const propertyLines = listings.map(
    (listing) => {
      const generatedLine =
        copy.reelListingLines[listing.mlsNumber];

      if (!generatedLine) {
        throw new Error(
          `Generated Reel copy is missing MLS ${listing.mlsNumber}.`,
        );
      }

      return cleanSentence(generatedLine);
    },
  );

  return [
    cleanSentence(copy.reelIntro),
    ...propertyLines,
    EXACT_REEL_CTA,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInstagramCaption(
  copy: GeneratedCopy,
  listings: SelectedListing[],
): string {
  const listingLines = listings
    .map((listing) => {
      const reduction =
        formatRoundedReduction(
          listing.totalPriceReduction,
        );

      const priceLine = reduction
        ? `${formatCurrency(
            listing.currentPrice,
          )} | ${capitalize(reduction)}`
        : formatCurrency(
            listing.currentPrice,
          );

      return [
        `🏡 ${listing.address}`,
        priceLine,
      ].join("\n");
    })
    .join("\n\n");

  return [
    cleanParagraph(copy.instagramIntro),
    "",
    listingLines,
    "",
    cleanParagraph(copy.instagramClosing),
    "",
    INSTAGRAM_HASHTAGS,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildYoutubeDescription(
  copy: GeneratedCopy,
  listings: SelectedListing[],
): string {
  const listingLines = listings
    .map((listing) => {
      const reduction =
        formatRoundedReduction(
          listing.totalPriceReduction,
        );

      return [
        `• ${listing.address}`,
        `Current price: ${formatCurrency(
          listing.currentPrice,
        )}`,
        reduction
          ? `Price reduction: ${capitalize(
              reduction,
            )}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    cleanParagraph(copy.youtubeIntro),
    "",
    "Homes featured:",
    "",
    listingLines,
    "",
    cleanParagraph(copy.youtubeClosing),
    "",
    CONTACT_BLOCK,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateGeneratedCopy(
  copy: GeneratedCopy,
  listings: SelectedListing[],
): void {
  if (
    !copy ||
    typeof copy !== "object" ||
    typeof copy.reelIntro !== "string" ||
    typeof copy.instagramIntro !== "string" ||
    typeof copy.instagramClosing !== "string" ||
    typeof copy.youtubeIntro !== "string" ||
    typeof copy.youtubeClosing !== "string" ||
    typeof copy.youtubeKeywords !== "string" ||
    !copy.reelListingLines ||
    typeof copy.reelListingLines !== "object"
  ) {
    throw new Error(
      "Generated content response is missing required fields.",
    );
  }

  const expectedMlsNumbers = new Set(
    listings.map(
      (listing) => listing.mlsNumber,
    ),
  );

  const returnedMlsNumbers = Object.keys(
    copy.reelListingLines,
  );

  if (
    returnedMlsNumbers.length !==
    expectedMlsNumbers.size
  ) {
    throw new Error(
      "Generated Reel lines do not match the number of selected listings.",
    );
  }

  for (const listing of listings) {
    const line =
      copy.reelListingLines[
        listing.mlsNumber
      ];

    const lineWordCount = line
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    if (lineWordCount < 6) {
      throw new Error(
        `Generated Reel line for MLS ${listing.mlsNumber} is too short.`,
      );
    }

    if (
      containsStreetNumber(
        line,
        listing.address,
      )
    ) {
      throw new Error(
        `Generated Reel line includes the street address for MLS ${listing.mlsNumber}.`,
      );
    }

    const formattedPrice =
      formatCurrency(
        listing.currentPrice,
      );

    if (!line.includes(formattedPrice)) {
      throw new Error(
        `Generated Reel line is missing ${formattedPrice}.`,
      );
    }
  }

  for (const returnedMls of returnedMlsNumbers) {
    if (!expectedMlsNumbers.has(returnedMls)) {
      throw new Error(
        `Generated content included unknown MLS ${returnedMls}.`,
      );
    }
  }
}

function validateFinalContent(
  content: GeneratedContent,
  listings: SelectedListing[],
): void {
  const wordCount = content.reelScript
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 100) {
    throw new Error(
      `Generated Reel script has only ${wordCount} words.`,
    );
  }

  if (wordCount > 190) {
    console.warn(
      `Generated Reel script has ${wordCount} words. Trimming to a shorter version.`,
    );

    content.reelScript = trimReelScript(
      content.reelScript,
      175,
    );
  }

  if (
    !content.reelScript.endsWith(
      EXACT_REEL_CTA,
    )
  ) {
    throw new Error(
      "Generated Reel script is missing the required CTA.",
    );
  }

  for (const listing of listings) {
    const streetAddress =
      getStreetAddress(
        listing.address,
      );

    const requiredSurfaces = [
      {
        name: "Instagram caption",
        value: content.instagramCaption,
      },
      {
        name: "YouTube description",
        value:
          content.youtubeShortsDescription,
      },
    ];

    for (const surface of requiredSurfaces) {
      if (
        !normalize(surface.value).includes(
          normalize(streetAddress),
        )
      ) {
        throw new Error(
          `${surface.name} is missing selected listing: ${listing.address}`,
        );
      }
    }

    if (
      containsStreetNumber(
        content.reelScript,
        listing.address,
      )
    ) {
      throw new Error(
        `Reel script contains the street address for MLS ${listing.mlsNumber}.`,
      );
    }
  }

  const hashtagCount =
    content.instagramCaption.match(
      /#[A-Za-z0-9_]+/g,
    )?.length ?? 0;

  if (hashtagCount !== 5) {
    throw new Error(
      `Instagram caption contains ${hashtagCount} hashtags. Expected exactly 5.`,
    );
  }

  if (
    !content.youtubeShortsDescription.includes(
      "(971) 285-2002",
    )
  ) {
    throw new Error(
      "YouTube description is missing Steven's contact block.",
    );
  }
}

function createLocationLabel(
  listing: SelectedListing,
): string {
  const reason =
    listing.shortReason.trim();

  const knownLocations = [
    "Royal Woodlands",
    "Village at Orenco",
    "Orenco",
    "Bull Mountain",
    "Bethany",
    "Aloha",
    "Burntwood West",
    "Beaverton",
    "Hillsboro",
    "Portland",
  ];

  for (const location of knownLocations) {
    if (
      reason.toLowerCase().includes(
        location.toLowerCase(),
      )
    ) {
      return `a home in ${location}`;
    }
  }

  const city = extractCity(
    listing.address,
  );

  if (city) {
    return `a home in ${city}`;
  }

  return "this Portland Metro home";
}

function extractCity(
  address: string,
): string | null {
  const match = address.match(
    /\s+(Beaverton|Portland|Hillsboro|Tigard|Lake Oswego|Sherwood|Tualatin|Aloha|Bethany|Vancouver|Camas|Ridgefield|Oregon City|Happy Valley),?\s+(?:OR|WA)\s+\d{5}/i,
  );

  return match?.[1] ?? null;
}

function containsStreetNumber(
  value: string,
  address: string,
): boolean {
  const streetNumber =
    address.match(/^\d+/)?.[0];

  if (!streetNumber) {
    return false;
  }

  return new RegExp(
    `\\b${escapeRegExp(streetNumber)}\\b`,
  ).test(value);
}

function getStreetAddress(
  address: string,
): string {
  const cityStatePattern =
    /\s+(?:Beaverton|Portland|Hillsboro|Tigard|Lake Oswego|Sherwood|Tualatin|Aloha|Bethany|Vancouver|Camas|Ridgefield|Oregon City|Happy Valley),?\s+(?:OR|WA)\s+\d{5}(?:-\d{4})?$/i;

  return address
    .replace(cityStatePattern, "")
    .trim();
}

function formatCurrency(
  value: number,
): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRoundedReduction(
  value: number | null,
): string | null {
  if (value === null || value <= 0) {
    return null;
  }

  const rounded =
    Math.round(value / 1000) * 1000;

  return `about ${formatCurrency(
    rounded,
  )} below the original list price`;
}

function normalizeKeywords(
  value: string,
): string {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter(
      (keyword, index, all) =>
        all.findIndex(
          (item) =>
            item.toLowerCase() ===
            keyword.toLowerCase(),
        ) === index,
    )
    .join(", ");
}

function cleanSentence(
  value: string,
): string {
  const cleaned = value
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return /[.!?]$/.test(cleaned)
    ? cleaned
    : `${cleaned}.`;
}

function cleanParagraph(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(
  value: string,
): string {
  if (!value) {
    return value;
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function normalize(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(/[.,#'’\-|]/g, " ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function trimReelScript(
  script: string,
  targetWords: number,
): string {
  const withoutCta = script
    .replace(EXACT_REEL_CTA, "")
    .trim();

  const sentences =
    withoutCta.match(/[^.!?]+[.!?]+/g) ?? [
      withoutCta,
    ];

  const keptSentences: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    if (
      keptSentences.length > 0 &&
      wordCount + sentenceWords >
        targetWords - 20
    ) {
      break;
    }

    keptSentences.push(sentence.trim());
    wordCount += sentenceWords;
  }

  return [
    keptSentences.join(" "),
    EXACT_REEL_CTA,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
