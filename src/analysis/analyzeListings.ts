import OpenAI from "openai";
import type { RmlsListing } from "../rmls/parseListings.js";
import type { WeeklyAnalysis } from "./types.js";

const DEFAULT_MODEL = "gpt-5-mini";

export async function analyzeListings(
  listings: RmlsListing[],
): Promise<WeeklyAnalysis> {
  if (listings.length === 0) {
    throw new Error("Cannot analyze an empty listing list.");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to the root .env file.",
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  const model =
    process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  console.log(
    `Analyzing ${listings.length} listings with ${model}...`,
  );

  const listingData = listings.map((listing) => ({
    mlsNumber: listing.mlsNumber,
    address: listing.address,
    currentPrice: listing.currentPrice,
    bedrooms: listing.bedrooms,
    fullBathrooms: listing.fullBathrooms,
    partialBathrooms: listing.partialBathrooms,
    squareFeet: listing.squareFeet,
    pricePerSquareFoot:
      listing.currentPrice && listing.squareFeet
        ? Math.round(
            listing.currentPrice / listing.squareFeet,
          )
        : null,
    status: listing.status,
    listDate: listing.listDate,
    daysOnMarket: listing.daysOnMarket,
    acres: listing.acres,
    yearBuilt: listing.yearBuilt,
    propertyType: listing.propertyType,
    style: listing.style,
    county: listing.county,
    neighborhood: listing.neighborhood,
    remarks: listing.remarks,
  }));

  const response = await client.responses.create({
    model,
    store: false,
    instructions: `
    You are helping Steven Tran, an experienced Portland-area real estate
    broker, select homes for a fast weekly social media video.

    Compare all listings against one another and select the best 4 or 5
    opportunities for general homebuyer interest.

    Primary goals:
    - Favor desirable Portland-metro locations.
    - Favor strong apparent value relative to size, features, neighborhood
      and current price.
    - Favor homes that are visually or verbally interesting for social media.
    - Consider price per square foot, layout, lot, updates, year built,
      neighborhood, remarks and general buyer appeal.
    - Do not claim that a home is definitively underpriced, a great buy,
      an investment opportunity or guaranteed to sell quickly without
      supporting comparable-sales data.
    - Use phrases such as "worth a look," "stands out," "interesting option,"
      or "appears competitively priced."
    - Do not invent facts, amenities, schools, condition or price history.
    - Every listing in this data came from an RMLS search for homes that had
      a price change of at least $20,000 within the prior seven days.
    - The exact prior price and exact reduction are not available.
    - Use the literal placeholder "[ADD EXACT DROP]" wherever Steven should
      manually insert the exact price reduction.
    - The final reel script must be 80 to 95 spoken words.
    - Cover 4 or 5 homes very quickly.
    - Mention only the most compelling one or two details per home.
    - Do not include greetings, disclaimers, emojis or stage directions.
    - Avoid phrases like "hot deals," "great buys," "huge value,"
      "dream home" or other exaggerated sales language.
    - Write in a direct, natural, conversational Realtor voice.
    - End with one simple engagement question.
    - Return valid JSON only. Do not wrap it in Markdown.
    `,
    input: `
Analyze these listings:

${JSON.stringify(listingData, null, 2)}

Return JSON matching this exact structure:

{
  "title": "string",
  "summary": "string",
  "selectedListings": [
    {
      "rank": 1,
      "mlsNumber": "string",
      "address": "string",
      "currentPrice": 0,
      "exactDropPlaceholder": "[ADD EXACT DROP]",
      "shortReason": "string",
      "concern": "string",
      "spokenLine": "string"
    }
  ],
  "reelScript": "string",
  "factCheckNotes": [
    "string"
  ]
}

Requirements:
- Select 4 or 5 listings.
- Use only MLS numbers found in the input.
- Keep shortReason to one concise, fact-based sentence.
- Keep concern concise. Use "None obvious from listing data" if needed.
- currentPrice must match the provided data exactly.
- The reelScript must contain [ADD EXACT DROP] for each selected home.
- The reelScript must be between 110 and 140 words.
- The reelScript should begin with a short hook.
- Use natural transitions between properties.
- Avoid starting every property sentence with the address.
- Include one or two strong details from the public remarks for each property.
- Do not describe a listing as a deal, bargain, great buy or definitively underpriced.
- End with this exact sentence:
  "If any of these homes caught your attention, call or text me and I’ll send you the details."
- Do not include fields outside the requested structure.
`,
  });

  const output = response.output_text.trim();

  if (!output) {
    throw new Error(
      "OpenAI returned an empty analysis response.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(stripCodeFence(output));
  } catch {
    throw new Error(
      `OpenAI returned invalid JSON:\n${output}`,
    );
  }

  return validateWeeklyAnalysis(parsed, listings);
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function validateWeeklyAnalysis(
  value: unknown,
  sourceListings: RmlsListing[],
): WeeklyAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error(
      "Analysis response was not a JSON object.",
    );
  }

  const result = value as Partial<WeeklyAnalysis>;

  if (
    typeof result.title !== "string" ||
    typeof result.summary !== "string" ||
    typeof result.reelScript !== "string" ||
    !Array.isArray(result.selectedListings) ||
    !Array.isArray(result.factCheckNotes)
  ) {
    throw new Error(
      "Analysis response is missing required fields.",
    );
  }

  if (
    result.selectedListings.length < 4 ||
    result.selectedListings.length > 5
  ) {
    throw new Error(
      "Analysis must select between 4 and 5 listings.",
    );
  }

  const sourceByMls = new Map(
    sourceListings.map((listing) => [
      listing.mlsNumber,
      listing,
    ]),
  );

  for (const selection of result.selectedListings) {
    const source = sourceByMls.get(selection.mlsNumber);

    if (!source) {
      throw new Error(
        `Analysis selected unknown MLS ${selection.mlsNumber}.`,
      );
    }

    if (selection.currentPrice !== source.currentPrice) {
      throw new Error(
        `Analysis changed the price for MLS ${selection.mlsNumber}.`,
      );
    }
  }
  
  const wordCount = result.reelScript
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 105 || wordCount > 150) {
    throw new Error(
      `Generated reel script has ${wordCount} words. Expected approximately 110 to 140.`,
    );
  }

  return result as WeeklyAnalysis;
}