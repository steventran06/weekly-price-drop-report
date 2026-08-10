import {
  createOpenAIClient,
  getOpenAIModel,
} from "../analysis/openaiClient.js";
import {
  parseOpenAIJson,
} from "../analysis/json.js";
import type {
  BuilderResearchResult,
  NewConstructionBuilder,
  NewConstructionCommunity,
  NewConstructionCommunityDetails,
  NewConstructionIncentive,
} from "./types.js";

const VALID_STATUSES = [
  "Now Selling",
  "Coming Soon",
  "Limited Availability",
  "Closeout",
  "Current Community",
] as const;

const INCENTIVE_TYPES = [
  "rate-buydown",
  "closing-cost",
  "design-credit",
  "price-reduction",
  "upgrade",
  "other",
] as const;

const NULLABLE_NUMBER = {
  anyOf: [
    { type: "number" },
    { type: "null" },
  ],
};

const INCENTIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "description",
    "type",
    "amount",
    "interestRate",
    "appliesTo",
    "requirements",
    "expirationDate",
    "sourceUrl",
    "verifiedAt",
  ],
  properties: {
    headline: { type: "string" },
    description: { type: "string" },
    type: {
      type: "string",
      enum: INCENTIVE_TYPES,
    },
    amount: NULLABLE_NUMBER,
    interestRate: { type: "string" },
    appliesTo: { type: "string" },
    requirements: { type: "string" },
    expirationDate: { type: "string" },
    sourceUrl: { type: "string" },
    verifiedAt: { type: "string" },
  },
};

const RANGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["min", "max", "text"],
  properties: {
    min: NULLABLE_NUMBER,
    max: NULLABLE_NUMBER,
    text: { type: "string" },
  },
};

const PRICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["from", "to", "text"],
  properties: {
    from: NULLABLE_NUMBER,
    to: NULLABLE_NUMBER,
    text: { type: "string" },
  },
};

const HOA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["amount", "frequency", "text"],
  properties: {
    amount: NULLABLE_NUMBER,
    frequency: { type: "string" },
    text: { type: "string" },
  },
};

const DETAILS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "pricing",
    "squareFeet",
    "bedrooms",
    "bathrooms",
    "floorPlanCount",
    "quickMoveInCount",
    "quickMoveInUrl",
    "modelHomeAddress",
    "salesOfficeHours",
    "hoa",
    "amenities",
    "highlights",
    "incentives",
  ],
  properties: {
    pricing: PRICE_SCHEMA,
    squareFeet: RANGE_SCHEMA,
    bedrooms: RANGE_SCHEMA,
    bathrooms: RANGE_SCHEMA,
    floorPlanCount: NULLABLE_NUMBER,
    quickMoveInCount: NULLABLE_NUMBER,
    quickMoveInUrl: { type: "string" },
    modelHomeAddress: { type: "string" },
    salesOfficeHours: { type: "string" },
    hoa: HOA_SCHEMA,
    amenities: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    highlights: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    incentives: {
      type: "array",
      maxItems: 4,
      items: INCENTIVE_SCHEMA,
    },
  },
};

const COMMUNITY_PROPERTIES = {
  name: { type: "string" },
  city: { type: "string" },
  status: {
    type: "string",
    enum: VALID_STATUSES,
  },
  homeType: { type: "string" },
  sourceUrl: { type: "string" },
  note: { type: "string" },
  details: DETAILS_SCHEMA,
};

const RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "builderIncentives",
    "verifiedExistingNames",
    "communityUpdates",
    "removals",
    "newCommunities",
    "researchNotes",
  ],
  properties: {
    builderIncentives: {
      type: "array",
      maxItems: 6,
      items: INCENTIVE_SCHEMA,
    },
    verifiedExistingNames: {
      type: "array",
      maxItems: 50,
      items: { type: "string" },
    },
    communityUpdates: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "city",
          "status",
          "homeType",
          "sourceUrl",
          "note",
          "details",
        ],
        properties: COMMUNITY_PROPERTIES,
      },
    },
    removals: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "sourceUrl", "reason"],
        properties: {
          name: { type: "string" },
          sourceUrl: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    newCommunities: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "city",
          "status",
          "homeType",
          "sourceUrl",
          "note",
          "details",
        ],
        properties: COMMUNITY_PROPERTIES,
      },
    },
    researchNotes: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
  },
};

export async function researchBuilder(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  verifiedDate: string,
): Promise<BuilderResearchResult> {
  const client = createOpenAIClient();
  const model =
    process.env.NEW_CONSTRUCTION_OPENAI_MODEL?.trim() ||
    getOpenAIModel();

  const timeoutMs = readPositiveInteger(
    process.env.NEW_CONSTRUCTION_RESEARCH_TIMEOUT_MS,
    60_000,
    20_000,
    120_000,
  );
  const maxOutputTokens = readPositiveInteger(
    process.env.NEW_CONSTRUCTION_MAX_OUTPUT_TOKENS,
    6_000,
    2_000,
    10_000,
  );

  console.log("");
  console.log(`Researching ${builder.name}...`);
  console.log(`Official domain only: ${builder.domain}`);
  console.log(`Model: ${model}`);
  console.log("Reasoning effort: low");
  console.log("Web search context: low");
  console.log(`Hard request timeout: ${Math.round(timeoutMs / 1000)}s; retries: 0`);

  const currentCommunities = existingCommunities.map(
    (community) => ({
      name: community.name,
      city: community.city,
      status: community.status,
      homeType: community.homeType,
      sourceUrl: community.sourceUrl,
      lastVerified: community.lastVerified,
    }),
  );

  const response = await client.responses.create(
    {
      model,
      store: false,
      reasoning: {
        effort: "low",
      },
      max_output_tokens: maxOutputTokens,
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
          filters: {
            allowed_domains: [builder.domain],
          },
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "new_construction_builder_research_v5",
          description:
            "Budget-conscious current new-construction facts from one builder's official website.",
          strict: true,
          schema: RESEARCH_SCHEMA,
        },
      },
      instructions: buildInstructions(verifiedDate),
      input: JSON.stringify(
        {
          verifiedDate,
          builder: {
            id: builder.id,
            name: builder.name,
            domain: builder.domain,
            website: builder.website,
            sourceUrl:
              builder.sourceUrl || builder.website,
          },
          existingCommunities: currentCommunities,
        },
        null,
        2,
      ),
    } as any,
    {
      timeout: timeoutMs,
      maxRetries: 0,
    },
  );

  const result = parseOpenAIJson<BuilderResearchResult>(
    response.output_text,
    `${builder.name} new-construction research`,
  );

  validateResearchResult(
    builder,
    existingCommunities,
    result,
  );

  return result;
}

function buildInstructions(
  verifiedDate: string,
): string {
  return `
You maintain a consumer-facing new-construction database for Steven Tran, an
Oregon and Washington real estate broker.

This job is intentionally budget-conscious. Perform ONE practical research
pass and then stop. Do not exhaustively chase missing facts. If a useful fact
is not readily supported by the official builder website, leave it blank and
move on. There is no second reasoning pass.

SOURCE RULES
- You MUST use web search.
- Use ONLY the builder's official domain in the tool allowlist.
- Do not use Zillow, Redfin, Realtor.com, NewHomeSource, social media, news,
  blogs, MLS data, other domains, or model memory.
- Start with the supplied existing community source URLs/names, the builder's
  regional community directory, and obvious official promotions/specials
  pages.
- Do not spend extra searches trying to fill every optional field.
- Every returned sourceUrl, quickMoveInUrl, and incentive sourceUrl must be on
  the official allowed domain.
- For communityUpdates and newCommunities, sourceUrl should be the specific
  official COMMUNITY PAGE whenever one exists. Do not substitute a promotions
  page for the community source; promotions belong in incentive sourceUrl.

GEOGRAPHIC SCOPE
Portland Metro in Oregon and Clark County / immediate Southwest Washington.
Include Portland, Beaverton, Hillsboro, Tigard, Tualatin, Sherwood,
Wilsonville, Lake Oswego, West Linn, Happy Valley, Clackamas, Gresham,
Troutdale, Oregon City, Milwaukie, Forest Grove, Cornelius, North Plains,
Vancouver, Camas, Washougal, Ridgefield, Battle Ground and La Center when
supported by the builder site. Exclude Salem, Central Oregon, Seattle-area and
other distant markets.

EXISTING COMMUNITIES
- Put an existing community name in verifiedExistingNames when you found clear
  official evidence that the community is still current/upcoming.
- Preserve the supplied existing name EXACTLY.
- Put a community in communityUpdates only when you found useful CURRENT facts
  worth publishing, such as pricing, product ranges, quick move-ins, model
  information, amenities, a status/source change, or a community-specific
  incentive.
- Do NOT return unchanged full records just to prove you looked at them.
- If you cannot confirm an existing community, simply omit it from
  verifiedExistingNames and communityUpdates. The application will preserve
  its basic directory record without claiming fresh verification.

REMOVALS
- Use removals ONLY when the official site explicitly supports sold out,
  closed, no longer selling, or otherwise discontinued.
- Mere absence from a search result or directory is NOT enough to remove.
- sourceUrl for a removal must be the official page supporting the conclusion.

DETAILS TO CAPTURE WHEN READILY AVAILABLE
- current starting price or price range;
- square-footage range;
- bedroom and bathroom ranges;
- floor-plan count;
- current quick-move-in / move-in-ready count and URL;
- model-home or sales-office address;
- published sales-office/model hours;
- HOA amount/frequency only when explicitly published;
- concrete amenities;
- concise factual highlights.

Use null for unsupported numeric facts, "" for unsupported text, and [] for
unsupported lists. Do not infer ranges from individual inventory homes.

INCENTIVES
Look for obvious official specials/promotions/financing pages, but do not keep
searching if a current offer is not readily available.

Return an incentive ONLY when the official site clearly supports a CURRENT
concrete offer. Capture:
- headline and factual description;
- type;
- explicit dollar amount or rate, otherwise leave blank/null;
- what homes/communities it applies to;
- material requirements/fine print that are readily visible;
- expirationDate as YYYY-MM-DD only when explicit, otherwise "";
- exact official source URL;
- verifiedAt = ${verifiedDate}.

Do not generalize a select-home offer to a whole community or builder. Do not
infer a rate, dollar amount, eligibility rule, or expiration. Omit expired or
unclear offers.

NEW COMMUNITIES
Add only communities clearly marketed by this builder on its official site in
the geographic scope. Do not add individual inventory homes as communities.

PRIORITY ORDER
1. Confirm existing communities quickly.
2. Capture obvious current incentives.
3. Capture useful details that are readily present on community pages.
4. Add clearly visible new communities.
5. Stop. Missing optional fields are acceptable.

Return only the structured result.
`;
}

function validateResearchResult(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
): void {
  if (
    !Array.isArray(result.builderIncentives) ||
    !Array.isArray(result.verifiedExistingNames) ||
    !Array.isArray(result.communityUpdates) ||
    !Array.isArray(result.removals) ||
    !Array.isArray(result.newCommunities) ||
    !Array.isArray(result.researchNotes)
  ) {
    throw new Error(
      `${builder.name} research returned an invalid result shape.`,
    );
  }

  const expectedNames = new Set(
    existingCommunities.map((community) => community.name),
  );

  validateKnownNameList(
    builder,
    expectedNames,
    result.verifiedExistingNames,
    "verified community",
  );

  const updatedNames = new Set<string>();
  for (const update of result.communityUpdates) {
    if (!expectedNames.has(update.name)) {
      throw new Error(
        `${builder.name} research returned an unknown community update: ${update.name}`,
      );
    }
    if (updatedNames.has(update.name)) {
      throw new Error(
        `${builder.name} research returned duplicate update: ${update.name}`,
      );
    }
    updatedNames.add(update.name);
    validateCommunityUrls(
      builder,
      update.name,
      update.sourceUrl,
      update.details,
    );
  }

  const removedNames = new Set<string>();
  for (const removal of result.removals) {
    if (!expectedNames.has(removal.name)) {
      throw new Error(
        `${builder.name} research returned an unknown removal: ${removal.name}`,
      );
    }
    if (removedNames.has(removal.name)) {
      throw new Error(
        `${builder.name} research returned duplicate removal: ${removal.name}`,
      );
    }
    if (updatedNames.has(removal.name)) {
      throw new Error(
        `${builder.name} research both updated and removed: ${removal.name}`,
      );
    }
    removedNames.add(removal.name);
    if (!isOfficialUrl(removal.sourceUrl, builder.domain)) {
      throw new Error(
        `${builder.name} removal used a non-official source for ${removal.name}.`,
      );
    }
  }

  for (const community of result.newCommunities) {
    validateCommunityUrls(
      builder,
      community.name,
      community.sourceUrl,
      community.details,
    );
  }

  for (const incentive of result.builderIncentives) {
    validateIncentive(builder, "builder", incentive);
  }
}

function validateKnownNameList(
  builder: NewConstructionBuilder,
  expectedNames: Set<string>,
  values: string[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const name of values) {
    if (!expectedNames.has(name)) {
      throw new Error(
        `${builder.name} research returned unknown ${label}: ${name}`,
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `${builder.name} research returned duplicate ${label}: ${name}`,
      );
    }
    seen.add(name);
  }
}

function validateCommunityUrls(
  builder: NewConstructionBuilder,
  communityName: string,
  sourceUrl: string,
  details: NewConstructionCommunityDetails,
): void {
  if (!isOfficialUrl(sourceUrl, builder.domain)) {
    throw new Error(
      `${builder.name} research used a non-official source for ${communityName}: ${sourceUrl}`,
    );
  }

  if (
    details.quickMoveInUrl &&
    !isOfficialUrl(details.quickMoveInUrl, builder.domain)
  ) {
    throw new Error(
      `${builder.name} research used a non-official quick-move-in URL for ${communityName}.`,
    );
  }

  for (const incentive of details.incentives) {
    validateIncentive(builder, communityName, incentive);
  }
}

function validateIncentive(
  builder: NewConstructionBuilder,
  scope: string,
  incentive: NewConstructionIncentive,
): void {
  if (!isOfficialUrl(incentive.sourceUrl, builder.domain)) {
    throw new Error(
      `${builder.name} research used a non-official incentive source for ${scope}: ${incentive.sourceUrl}`,
    );
  }

  if (
    incentive.expirationDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(incentive.expirationDate)
  ) {
    throw new Error(
      `${builder.name} research returned invalid incentive expiration date: ${incentive.expirationDate}`,
    );
  }
}

export function isOfficialUrl(
  value: string,
  allowedDomain: string,
): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const domain = allowedDomain
      .toLowerCase()
      .replace(/^www\./, "");
    const normalizedHost = hostname.replace(/^www\./, "");

    return (
      normalizedHost === domain ||
      normalizedHost.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function emptyCommunityDetails(): NewConstructionCommunityDetails {
  return {
    pricing: {
      from: null,
      to: null,
      text: "",
    },
    squareFeet: {
      min: null,
      max: null,
      text: "",
    },
    bedrooms: {
      min: null,
      max: null,
      text: "",
    },
    bathrooms: {
      min: null,
      max: null,
      text: "",
    },
    floorPlanCount: null,
    quickMoveInCount: null,
    quickMoveInUrl: "",
    modelHomeAddress: "",
    salesOfficeHours: "",
    hoa: {
      amount: null,
      frequency: "",
      text: "",
    },
    amenities: [],
    highlights: [],
    incentives: [],
  };
}

export function clearVolatileDetails(
  details: NewConstructionCommunityDetails | undefined,
): NewConstructionCommunityDetails {
  const current = details || emptyCommunityDetails();

  return {
    pricing: {
      from: null,
      to: null,
      text: "",
    },
    squareFeet: current.squareFeet || emptyCommunityDetails().squareFeet,
    bedrooms: current.bedrooms || emptyCommunityDetails().bedrooms,
    bathrooms: current.bathrooms || emptyCommunityDetails().bathrooms,
    floorPlanCount: current.floorPlanCount ?? null,
    quickMoveInCount: null,
    quickMoveInUrl: "",
    modelHomeAddress: current.modelHomeAddress || "",
    salesOfficeHours: "",
    hoa: {
      amount: null,
      frequency: "",
      text: "",
    },
    amenities: Array.isArray(current.amenities) ? current.amenities : [],
    highlights: Array.isArray(current.highlights) ? current.highlights : [],
    incentives: [],
  };
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(parsed, max));
}
