import OpenAI from "openai";
import type { RmlsListing } from "../rmls/parseListings.js";
import type {
  SelectedListing,
  WeeklyAnalysis,
} from "./types.js";

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
    - Read and use the public remarks for every listing.
    - Pull out specific, buyer-relevant details from the remarks, including
      renovations, system updates, outdoor spaces, flexible rooms, views,
      garages, lot features, newer construction and distinctive design.
    - Favor concrete listing details over generic adjectives.
    - The reel script should sound conversational when spoken aloud.
    - Use natural transitions and varied sentence structures.
    - For each listing, the script should mention the price drop. Since we do not know what that is, please put "it is down [EMPTY PRICE DROP]"" in the script for me to fill in.
    - The reel script should be approximately 110 to 150 spoken words.
    - End every reel script with this exact CTA:
      "Comment price drop if any of these homes interest you, or you call or text me and I’ll send you the details."

    - Create an Instagram caption for the Portland Metro Price Alert series.
    - Begin the Instagram caption with a concise hook.
    - List every selected home on its own line with its full address and
      current price.
    - Add a short CTA inviting viewers to call or text Steven.
    - Use only a small number of useful emojis.
    - Keep the Instagram caption natural and easy to scan.
    - End the Instagram caption with exactly these five hashtags:
      "#PortlandRealEstate #BeavertonRealEstate #PortlandMetro #HomesForSale #PriceDrop"
    - Create one compelling YouTube Shorts title.
    - Keep the YouTube title under 70 characters.
    - The title should clearly reference Portland Metro price drops.
    - Avoid clickbait claims that are not supported by the listing data.

    - Create a YouTube Shorts description.
    - Begin with a concise explanation of the weekly series.
    - List each selected home with its full address and current price.
    - Include Steven's exact contact block supplied in the required output.
    - Do not use long dashes.
    - Do not use phrases such as "no fluff."

    - Create YouTube keywords as one comma-separated string.
    - Include relevant city, neighborhood, Portland Metro, real estate,
      homes-for-sale and price-drop search terms.
    - Do not use hashtags in the keyword string.
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
  "instagramCaption": "string",
  "youtubeShortsTitle": "string",
  "youtubeShortsDescription": "string",
  "youtubeKeywords": "string",
  "factCheckNotes": [
    "string"
  ]
}

Requirements:
- mlsNumber must contain only the exact numeric MLS number from the input.
- Never put an address, street name or any other value in mlsNumber.
- Copy both mlsNumber and address exactly from the corresponding input listing.
- Select exactly 5 listings when at least 5 suitable listings are available.
- Otherwise, select 4 listings.
- Use only MLS numbers found in the input.
- currentPrice must exactly match the provided listing data.
- Keep shortReason concise and based on the listing facts or public remarks.
- Keep concern concise. Use "None obvious from listing data" if needed.
- Use "[ADD EXACT DROP]" for every selected listing.
- The reelScript should be approximately 110 to 150 words.
- The reelScript must begin with a short conversational hook.
- Include one or two compelling public-remarks details per home.
- Use natural transitions rather than reading a repetitive list.
- End the reelScript with this exact sentence:
  "If any of these homes caught your attention, call or text me and I’ll send you the details."
- The Instagram caption must list all selected addresses and current prices.
- The YouTube Shorts title must be 70 characters or fewer.
- The YouTube description must list every selected address and price.
- End the YouTube description with this exact contact block:

Connect With Me
📞 Call / Text: (971) 285-2002
📧 Email: steven@diverserg.com
Instagram: https://instagram.com/steventranpdx
Facebook: https://www.facebook.com/StevenTranPDXRealtor/

📅 Schedule a call with me here:
👉 https://calendly.com/steven-diverserg/new-meeting

- youtubeKeywords must be one comma-separated string.
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
    typeof result.instagramCaption !== "string" ||
    typeof result.youtubeShortsTitle !== "string" ||
    typeof result.youtubeShortsDescription !== "string" ||
    typeof result.youtubeKeywords !== "string" ||
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

  const sourceByAddress = new Map(
    sourceListings
      .filter(
        (listing): listing is RmlsListing & { address: string } =>
          Boolean(listing.address),
      )
      .map((listing) => [
        normalizeAddress(listing.address),
        listing,
      ]),
  );

  for (const selection of result.selectedListings) {
    let source = sourceByMls.get(selection.mlsNumber);

    /*
     * Occasionally the model places an address in the mlsNumber field.
     * Recover by matching the selected address to the source listing.
     */
    if (!source && selection.address) {
      source = sourceByAddress.get(
        normalizeAddress(selection.address),
      );

      if (source) {
        selection.mlsNumber = source.mlsNumber;
      }
    }

    /*
     * Also try the malformed mlsNumber value as an address.
     */
    if (!source && selection.mlsNumber) {
      source = sourceByAddress.get(
        normalizeAddress(selection.mlsNumber),
      );

      if (source) {
        selection.mlsNumber = source.mlsNumber;
        selection.address = source.address ?? selection.address;
      }
    }

    if (!source) {
      throw new Error(
        `Analysis selected an unknown listing: ` +
          `${selection.mlsNumber} / ${selection.address}.`,
      );
    }

    selection.address = source.address ?? selection.address;
    selection.currentPrice = source.currentPrice ?? selection.currentPrice;

    if (selection.currentPrice !== source.currentPrice) {
      throw new Error(
        `Analysis changed the price for MLS ${source.mlsNumber}.`,
      );
    }
  }
  
  const wordCount = result.reelScript
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 100 || wordCount > 165) {
    throw new Error(
      `Generated reel script has ${wordCount} words. Expected approximately 110 to 150.`,
    );
  }

  if (result.youtubeShortsTitle.length > 70) {
    throw new Error(
      `YouTube Shorts title has ${result.youtubeShortsTitle.length} characters. Maximum is 70.`,
    );
  }

  const selectedListings =
    result.selectedListings as SelectedListing[];

  for (const listing of selectedListings) {
    const formattedPrice = listing.currentPrice.toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      },
    );

    if (
      !result.youtubeShortsDescription.includes(
        listing.address,
      )
    ) {
      throw new Error(
        `YouTube description is missing ${listing.address}.`,
      );
    }
  }

  function normalizeAddress(value: string): string {
    return value
      .toUpperCase()
      .replace(/[.,#]/g, " ")
      .replace(/\bSTREET\b/g, "ST")
      .replace(/\bAVENUE\b/g, "AVE")
      .replace(/\bPLACE\b/g, "PL")
      .replace(/\bDRIVE\b/g, "DR")
      .replace(/\bLANE\b/g, "LN")
      .replace(/\bCOURT\b/g, "CT")
      .replace(/\bROAD\b/g, "RD")
      .replace(/\bWAY\b/g, "WAY")
      .replace(/\s+/g, " ")
      .trim();
  }

  return result as WeeklyAnalysis;
}