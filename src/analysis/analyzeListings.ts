import type { RmlsListing } from "../rmls/parseListings.js";
import { generateContent } from "./generateContent.js";
import { parseOpenAIJson } from "./json.js";
import {
  createOpenAIClient,
  getOpenAIModel,
} from "./openaiClient.js";
import type {
  SelectedListing,
  WeeklyAnalysis,
} from "./types.js";

interface SelectionResponse {
  title: string;
  summary: string;
  selectedListings: SelectedListing[];
}

export async function analyzeListings(
  listings: RmlsListing[],
): Promise<WeeklyAnalysis> {
  if (listings.length === 0) {
    throw new Error(
      "Cannot analyze an empty listing list.",
    );
  }

  const client = createOpenAIClient();
  const model = getOpenAIModel();

  console.log(
    `Analyzing ${listings.length} listings with ${model}...`,
  );

  const response = await client.responses.create({
    model,
    store: false,
    instructions: SELECTION_INSTRUCTIONS,
    input: createSelectionInput(listings),
  });

  const selection =
    parseOpenAIJson<SelectionResponse>(
      response.output_text,
      "selection",
    );

  const validated = validateSelection(
    selection,
    listings,
  );

  console.log(
    `Selected ${validated.selectedListings.length} listing(s).`,
  );
  console.log(
    "Generating content from the selected listings...",
  );

  const content = await generateContent(
    validated.selectedListings,
  );

  return {
    ...validated,
    ...content,
    youtubeShortsTitle:
      createWeeklyYoutubeTitle(),
  };
}

const SELECTION_INSTRUCTIONS = `
You are helping Steven Tran, an experienced Portland-area real estate
broker, select homes for his weekly Portland Metro Price Alert video.

Compare all supplied listings and select the best five opportunities
for general homebuyer interest. If fewer than five are suitable,
select four.

Selection priorities:
- Read and use the public remarks for every listing.
- Favor appealing Portland Metro locations.
- Consider current price, total reduction from original list price,
  price per square foot, layout, lot, year built and buyer appeal.
- Favor renovations, newer systems, outdoor spaces, views, flexible
  living areas, distinctive architecture, larger garages and newer
  construction.
- Favor listings that will be interesting to discuss on camera.
- Do not claim a property is definitively underpriced without comps.
- Do not invent facts, features, schools, condition or price history.
- Copy each numeric MLS number and address exactly from the input.
- Return valid JSON only.
- Do not write social-media content.
`;

function createSelectionInput(
  listings: RmlsListing[],
): string {
  const listingData = listings.map(
    (listing) => ({
      mlsNumber: listing.mlsNumber,
      address: listing.address,
      currentPrice: listing.currentPrice,
      originalPrice: listing.originalPrice,
      totalPriceReduction:
        listing.totalPriceReduction,
      bedrooms: listing.bedrooms,
      fullBathrooms:
        listing.fullBathrooms,
      partialBathrooms:
        listing.partialBathrooms,
      squareFeet: listing.squareFeet,
      pricePerSquareFoot:
        listing.currentPrice &&
        listing.squareFeet
          ? Math.round(
              listing.currentPrice /
                listing.squareFeet,
            )
          : null,
      status: listing.status,
      listDate: listing.listDate,
      daysOnMarket:
        listing.daysOnMarket,
      acres: listing.acres,
      yearBuilt: listing.yearBuilt,
      propertyType:
        listing.propertyType,
      style: listing.style,
      county: listing.county,
      neighborhood:
        listing.neighborhood,
      remarks: listing.remarks,
    }),
  );

  return `
Select and rank the best listings from this data:

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
      "originalPrice": 0,
      "totalPriceReduction": 0,
      "shortReason": "string",
      "concern": "string",
      "spokenLine": "string"
    }
  ]
}

Requirements:
- Select five listings when at least five suitable listings exist.
- Otherwise, select four.
- Use only MLS numbers found in the input.
- Rank from strongest to weakest content opportunity.
- Keep shortReason concise and fact-based.
- Keep concern concise.
- Use "None obvious from listing data" when appropriate.
- spokenLine should be one concise suggested talking point.
- Do not include additional fields.
`;
}

function validateSelection(
  value: SelectionResponse,
  sourceListings: RmlsListing[],
): SelectionResponse {
  if (
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.selectedListings)
  ) {
    throw new Error(
      "Selection response is missing required fields.",
    );
  }

  if (
    value.selectedListings.length < 4 ||
    value.selectedListings.length > 5
  ) {
    throw new Error(
      "Selection response must contain 4 or 5 listings.",
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
        (
          listing,
        ): listing is RmlsListing & {
          address: string;
        } => Boolean(listing.address),
      )
      .map((listing) => [
        normalizeAddress(listing.address),
        listing,
      ]),
  );

  const usedMlsNumbers = new Set<string>();

  const selectedListings =
    value.selectedListings.map(
      (selection, index): SelectedListing => {
        const source = findSourceListing(
          selection,
          sourceByMls,
          sourceByAddress,
        );

        if (
          usedMlsNumbers.has(
            source.mlsNumber,
          )
        ) {
          throw new Error(
            `Selection contains duplicate MLS ${source.mlsNumber}.`,
          );
        }

        usedMlsNumbers.add(
          source.mlsNumber,
        );

        if (
          !source.address ||
          source.currentPrice === null
        ) {
          throw new Error(
            `Source listing ${source.mlsNumber} is missing required data.`,
          );
        }

        return {
          rank: index + 1,
          mlsNumber:
            source.mlsNumber,
          address: source.address,
          currentPrice:
            source.currentPrice,
          originalPrice:
            source.originalPrice,
          totalPriceReduction:
            source.totalPriceReduction,
          shortReason:
            cleanOptionalText(
              selection.shortReason,
              "Selected for its overall buyer appeal.",
            ),
          concern:
            cleanOptionalText(
              selection.concern,
              "None obvious from listing data",
            ),
          spokenLine:
            cleanOptionalText(
              selection.spokenLine,
              "",
            ),
        };
      },
    );

  return {
    title: value.title.trim(),
    summary: value.summary.trim(),
    selectedListings,
  };
}

function findSourceListing(
  selection: SelectedListing,
  sourceByMls: Map<string, RmlsListing>,
  sourceByAddress: Map<
    string,
    RmlsListing
  >,
): RmlsListing {
  const mlsNumber = String(
    selection.mlsNumber ?? "",
  );

  const source =
    sourceByMls.get(mlsNumber) ??
    (selection.address
      ? sourceByAddress.get(
          normalizeAddress(
            selection.address,
          ),
        )
      : undefined) ??
    sourceByAddress.get(
      normalizeAddress(mlsNumber),
    );

  if (!source) {
    throw new Error(
      `Selection contains an unknown listing: ` +
        `${selection.mlsNumber} / ${selection.address}.`,
    );
  }

  return source;
}

function cleanOptionalText(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : fallback;
}

function normalizeAddress(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(/[.,#'’\-]/g, " ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\s+/g, " ")
    .trim();
}

function createWeeklyYoutubeTitle(): string {
  const date =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Los_Angeles",
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    ).format(new Date());

  return `Portland Metro Price Drops | ${date}`;
}