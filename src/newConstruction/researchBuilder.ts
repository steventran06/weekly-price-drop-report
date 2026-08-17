import {
  createOpenAIClient,
  getOpenAIModel,
} from "../analysis/openaiClient.js";
import {
  parseOpenAIJson,
} from "../analysis/json.js";
import type {
  BuilderResearchResult,
  CommunityRemoval,
  CommunityResearchUpdate,
  NewConstructionBuilder,
  NewConstructionCommunity,
  NewConstructionCommunityDetails,
  NewConstructionIncentive,
  ResearchedCommunity,
} from "./types.js";

interface BuilderDirectorySnapshot {
  sourceUrls: string[];
  searchableText: string;
}

interface CommunitySourcePageSnapshot {
  requestedUrl: string;
  finalUrl: string;
  searchableText: string;
}

type NewCommunityVerificationDecision =
  | "active"
  | "inactive"
  | "uncertain";

interface NewCommunityVerificationItem {
  name: string;
  decision: NewCommunityVerificationDecision;
  sourceUrl: string;
  evidence: string;
}

interface NewCommunityVerificationResult {
  communities: NewCommunityVerificationItem[];
  researchNotes: string[];
}

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

const ALLOWED_NEW_COMMUNITY_CITY_NAMES = [
  "Portland",
  "Beaverton",
  "Hillsboro",
  "Tigard",
  "Tualatin",
  "Sherwood",
  "Wilsonville",
  "Lake Oswego",
  "West Linn",
  "Happy Valley",
  "Clackamas",
  "Gresham",
  "Troutdale",
  "Oregon City",
  "Milwaukie",
  "Forest Grove",
  "Cornelius",
  "North Plains",
  "Vancouver",
  "Camas",
  "Washougal",
  "Ridgefield",
  "Battle Ground",
  "La Center",
] as const;

const ALLOWED_NEW_COMMUNITY_CITIES = new Set(
  ALLOWED_NEW_COMMUNITY_CITY_NAMES.map((city) =>
    normalizeCityKey(city),
  ),
);

const NEW_COMMUNITY_CITY_ALIASES = new Map<string, string>([
  ["bethany", "Portland"],
  ["north bethany", "Portland"],
  ["bonny slope", "Portland"],
  ["bonny slope portland", "Portland"],
  ["cedar mill", "Portland"],
]);

const DIRECTORY_INACTIVE_PHRASES = [
  "sold out",
  "sold-out",
  "community sold out",
  "homes sold out",
  "fully sold",
  "sales complete",
  "sales completed",
  "community complete",
  "closed",
  "discontinued",
  "no longer selling",
  "no longer available",
] as const;

const DIRECTORY_FETCH_MAX_BYTES = 750_000;
const DIRECTORY_FETCH_TIMEOUT_MS = 12_000;

const COMMUNITY_SOURCE_FETCH_MAX_BYTES = 750_000;
const COMMUNITY_SOURCE_FETCH_TIMEOUT_MS = 12_000;
const COMMUNITY_SOURCE_FETCH_CONCURRENCY = 3;
const COMMUNITY_SOURCE_FETCH_MAX_PAGES = 16;

const NEW_COMMUNITY_VERIFY_MAX_CANDIDATES = 16;

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

const NEW_COMMUNITY_VERIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "communities",
    "researchNotes",
  ],
  properties: {
    communities: {
      type: "array",
      maxItems: NEW_COMMUNITY_VERIFY_MAX_CANDIDATES,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "decision",
          "sourceUrl",
          "evidence",
        ],
        properties: {
          name: {
            type: "string",
          },
          decision: {
            type: "string",
            enum: [
              "active",
              "inactive",
              "uncertain",
            ],
          },
          sourceUrl: {
            type: "string",
          },
          evidence: {
            type: "string",
          },
        },
      },
    },
    researchNotes: {
      type: "array",
      maxItems: 12,
      items: {
        type: "string",
      },
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
  console.log("Targeted new-community verification: enabled when needed");
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

  const rawResult = parseOpenAIJson<BuilderResearchResult>(
    response.output_text,
    `${builder.name} new-construction research`,
  );

  assertResearchResultShape(
    builder,
    rawResult,
  );

  const verifiedDiscoveryResult =
    await applyTargetedNewCommunityVerification(
      builder,
      existingCommunities,
      rawResult,
      verifiedDate,
      model,
    );

  const [
    directorySnapshot,
    communitySourcePages,
  ] = await Promise.all([
    loadBuilderDirectorySnapshot(
      builder,
      existingCommunities,
      verifiedDiscoveryResult,
    ),
    loadPotentialNewCommunitySourcePages(
      builder,
      existingCommunities,
      verifiedDiscoveryResult,
    ),
  ]);

  const result = reconcileResearchResult(
    builder,
    existingCommunities,
    verifiedDiscoveryResult,
    directorySnapshot,
    communitySourcePages,
  );

  validateResearchResult(
    builder,
    existingCommunities,
    result,
  );

  return result;
}

async function applyTargetedNewCommunityVerification(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
  verifiedDate: string,
  model: string,
): Promise<BuilderResearchResult> {
  const allCandidates =
    collectPotentialNewCommunityCandidates(
      existingCommunities,
      result,
    );

  if (allCandidates.length === 0) {
    return result;
  }

  const candidates =
    allCandidates.slice(
      0,
      NEW_COMMUNITY_VERIFY_MAX_CANDIDATES,
    );

  const candidateNames = new Set(
    allCandidates.map((community) =>
      communityNameKey(community.name),
    ),
  );

  console.log(
    `${builder.name}: verifying ${candidates.length} proposed new ` +
      `communit${candidates.length === 1 ? "y" : "ies"} against the current official builder site...`,
  );

  const timeoutMs = readPositiveInteger(
    process.env.NEW_CONSTRUCTION_NEW_COMMUNITY_VERIFY_TIMEOUT_MS,
    45_000,
    15_000,
    90_000,
  );

  const maxOutputTokens = readPositiveInteger(
    process.env.NEW_CONSTRUCTION_NEW_COMMUNITY_VERIFY_MAX_OUTPUT_TOKENS,
    2_500,
    1_000,
    5_000,
  );

  let verification: NewCommunityVerificationResult;

  try {
    const client = createOpenAIClient();

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
              allowed_domains: [
                builder.domain,
              ],
            },
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "new_construction_new_community_verification_v1",
            description:
              "Independent current-status verification for proposed new communities using only the builder's official website.",
            strict: true,
            schema: NEW_COMMUNITY_VERIFICATION_SCHEMA,
          },
        },
        instructions:
          buildNewCommunityVerificationInstructions(
            builder,
            verifiedDate,
          ),
        input: JSON.stringify(
          {
            verifiedDate,
            builder: {
              id: builder.id,
              name: builder.name,
              domain: builder.domain,
              website: builder.website,
              sourceUrl:
                builder.sourceUrl ||
                builder.website,
            },
            proposedNewCommunities:
              candidates.map(
                (community) => ({
                  name:
                    community.name,
                  city:
                    community.city,
                  status:
                    community.status,
                  sourceUrl:
                    community.sourceUrl,
                  note:
                    community.note,
                }),
              ),
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

    verification =
      parseOpenAIJson<NewCommunityVerificationResult>(
        response.output_text,
        `${builder.name} proposed-new-community verification`,
      );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const note =
      `Targeted new-community verification failed; skipped ${candidates.length} proposed new communit${candidates.length === 1 ? "y" : "ies"}: ${message}`;

    console.warn(
      `${builder.name}: ${note}`,
    );

    /*
     * Fail closed for NEW records only.
     *
     * Existing-community updates remain usable, but if the independent
     * verification pass cannot run, do not add newly discovered communities.
     */
    return filterDiscoveryResultToVerifiedNewCommunities(
      builder,
      existingCommunities,
      result,
      candidateNames,
      new Map(),
      [
        note,
      ],
    );
  }

  if (
    !verification ||
    !Array.isArray(
      verification.communities,
    ) ||
    !Array.isArray(
      verification.researchNotes,
    )
  ) {
    const note =
      "Targeted new-community verification returned an invalid shape; proposed new communities were skipped.";

    console.warn(
      `${builder.name}: ${note}`,
    );

    return filterDiscoveryResultToVerifiedNewCommunities(
      builder,
      existingCommunities,
      result,
      candidateNames,
      new Map(),
      [
        note,
      ],
    );
  }

  const decisions =
    new Map<
      string,
      NewCommunityVerificationItem
    >();

  for (
    const item
    of verification.communities
  ) {
    const key =
      communityNameKey(
        item.name,
      );

    if (
      !key ||
      !candidateNames.has(
        key,
      )
    ) {
      continue;
    }

    const decision =
      normalizeNewCommunityVerificationDecision(
        item.decision,
      );

    const officialEvidence =
      isOfficialUrl(
        item.sourceUrl,
        builder.domain,
      );

    const normalizedItem:
      NewCommunityVerificationItem = {
        name:
          item.name,
        decision:
          officialEvidence
            ? decision
            : "uncertain",
        sourceUrl:
          officialEvidence
            ? item.sourceUrl
            : "",
        evidence:
          String(
            item.evidence ||
              "",
          ).trim(),
      };

    const existing =
      decisions.get(
        key,
      );

    /*
     * Prefer the more conservative decision if the verifier somehow returns
     * the same candidate more than once.
     */
    if (
      !existing ||
      verificationDecisionRisk(
        normalizedItem.decision,
      ) >
        verificationDecisionRisk(
          existing.decision,
        )
    ) {
      decisions.set(
        key,
        normalizedItem,
      );
    }
  }

  const verificationNotes: string[] = [];

  if (
    allCandidates.length >
    candidates.length
  ) {
    const overflow =
      allCandidates.length -
      candidates.length;

    const note =
      `Targeted verification cap reached; ${overflow} additional proposed new communit${overflow === 1 ? "y was" : "ies were"} rejected as unverified.`;

    console.warn(
      `${builder.name}: ${note}`,
    );
    verificationNotes.push(
      note,
    );
  }

  for (
    const candidate
    of candidates
  ) {
    const key =
      communityNameKey(
        candidate.name,
      );

    const item =
      decisions.get(
        key,
      );

    if (
      item?.decision ===
      "active"
    ) {
      const note =
        `Targeted verification confirmed ACTIVE new community: ${candidate.name}`;

      console.log(
        `${builder.name}: ${note}`,
      );
      verificationNotes.push(
        note,
      );
      continue;
    }

    if (
      item?.decision ===
      "inactive"
    ) {
      const note =
        `Targeted verification rejected INACTIVE new community: ${candidate.name}`;

      console.log(
        `${builder.name}: ${note}`,
      );
      verificationNotes.push(
        note,
      );
      continue;
    }

    const note =
      `Targeted verification rejected UNCERTAIN new community: ${candidate.name}`;

    console.log(
      `${builder.name}: ${note}`,
    );
    verificationNotes.push(
      note,
    );
  }

  return filterDiscoveryResultToVerifiedNewCommunities(
    builder,
    existingCommunities,
    result,
    candidateNames,
    decisions,
    [
      ...verification.researchNotes,
      ...verificationNotes,
    ],
  );
}

function collectPotentialNewCommunityCandidates(
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
): ResearchCommunityRecord[] {
  const byName =
    new Map<
      string,
      ResearchCommunityRecord
    >();

  for (
    const community
    of [
      ...result.communityUpdates,
      ...result.newCommunities,
    ]
  ) {
    if (
      findExistingCommunityByName(
        community.name,
        existingCommunities,
      )
    ) {
      continue;
    }

    if (
      findAmbiguousExistingCommunityMatches(
        community.name,
        existingCommunities,
      ).length >
      1
    ) {
      continue;
    }

    const canonicalCity =
      canonicalNewCommunityCity(
        community.city,
      );

    if (!canonicalCity) {
      continue;
    }

    const candidate = {
      ...community,
      city:
        canonicalCity,
    };

    if (
      looksLikeInactiveNewCommunity(
        candidate,
      )
    ) {
      continue;
    }

    const key =
      communityNameKey(
        candidate.name,
      );

    if (!key) {
      continue;
    }

    const existing =
      byName.get(
        key,
      );

    if (
      !existing ||
      communityRecordScore(
        candidate,
      ) >
        communityRecordScore(
          existing,
        )
    ) {
      byName.set(
        key,
        candidate,
      );
    }
  }

  return [
    ...byName.values(),
  ];
}

function filterDiscoveryResultToVerifiedNewCommunities(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
  candidateNames: Set<string>,
  decisions: Map<string, NewCommunityVerificationItem>,
  notes: string[],
): BuilderResearchResult {
  const shouldKeepPotentialNew =
    (
      community:
        ResearchCommunityRecord,
    ): boolean => {
      if (
        findExistingCommunityByName(
          community.name,
          existingCommunities,
        )
      ) {
        return true;
      }

      const key =
        communityNameKey(
          community.name,
        );

      /*
       * Records that were never eligible for the targeted verifier are left
       * for the normal reconciliation safeguards to handle. This includes
       * out-of-scope records and ambiguous umbrella names, which are rejected
       * deterministically later.
       */
      if (
        !key ||
        !candidateNames.has(
          key,
        )
      ) {
        return true;
      }

      const item =
        decisions.get(
          key,
        );

      if (
        item?.decision ===
        "active"
      ) {
        return true;
      }

      return false;
    };

  const communityUpdates =
    result.communityUpdates.filter(
      shouldKeepPotentialNew,
    );

  const newCommunities =
    result.newCommunities.filter(
      shouldKeepPotentialNew,
    );

  const rejectedCount =
    (
      result.communityUpdates.length -
      communityUpdates.length
    ) +
    (
      result.newCommunities.length -
      newCommunities.length
    );

  if (
    rejectedCount >
    0
  ) {
    console.log(
      `${builder.name}: targeted verification filtered ${rejectedCount} proposed new record${rejectedCount === 1 ? "" : "s"}.`,
    );
  }

  return {
    ...result,
    communityUpdates,
    newCommunities,
    researchNotes: [
      ...result.researchNotes,
      ...notes,
    ].slice(
      0,
      36,
    ),
  };
}

function buildNewCommunityVerificationInstructions(
  builder: NewConstructionBuilder,
  verifiedDate: string,
): string {
  return `
You are performing a SECOND, INDEPENDENT SAFETY CHECK on proposed new-home
communities for ${builder.name}.

This is NOT a discovery pass. Do not add communities that are not in the
provided proposedNewCommunities list.

DATE
Current verification date: ${verifiedDate}.

SOURCE RULES
- You MUST use web search.
- Use ONLY ${builder.domain}.
- Do not use model memory or any other website.
- Prefer the builder's CURRENT regional/community directory, market landing
  page, community finder, or current sales listing over a stale detail page.
- You may use a dedicated community page as supporting evidence, but the mere
  fact that an old detail page still loads is NOT sufficient to call a
  community active.
- sourceUrl must be the official ${builder.domain} page that best supports the
  decision.

DECISION RULES
Return EVERY proposed community exactly once.

decision = "active" ONLY when current official evidence clearly supports that
the community is presently marketed as one of the following:
- Now Selling
- Coming Soon
- Limited Availability
- Closeout / Final Opportunities
- Current Community
- otherwise clearly open for current or upcoming new-home sales

decision = "inactive" when current official evidence clearly says:
- Sold Out
- Closed
- Completed / Sales Complete
- Discontinued
- No Longer Selling
- No Longer Available
- or equivalent language showing buyers can no longer purchase new homes there

decision = "uncertain" when:
- current official evidence is conflicting;
- only a stale/legacy detail page can be found;
- the current regional/community directory does not clearly establish status;
- the candidate name/location appears inconsistent;
- the evidence is insufficient to confidently call it active or inactive.

IMPORTANT
- Be conservative. "uncertain" means the application will NOT add the new
  community yet.
- Do not mark a community active merely because floor plans, request-info
  forms, old inventory pages, or SEO pages still exist.
- If a current regional directory explicitly says Sold Out, that overrides a
  stale community detail page that still loads.
- Keep evidence concise and factual.

Return only the structured verification result.
`;
}

function normalizeNewCommunityVerificationDecision(
  value: string,
): NewCommunityVerificationDecision {
  if (
    value ===
      "active" ||
    value ===
      "inactive"
  ) {
    return value;
  }

  return "uncertain";
}

function verificationDecisionRisk(
  value: NewCommunityVerificationDecision,
): number {
  if (
    value ===
    "inactive"
  ) {
    return 3;
  }

  if (
    value ===
    "uncertain"
  ) {
    return 2;
  }

  return 1;
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
move on. There is no second discovery/reasoning pass. Proposed NEW
communities may be checked afterward by a separate targeted status verifier.

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
For NEW communities, city must be one of these supported locations:
Portland, Beaverton, Hillsboro, Tigard, Tualatin, Sherwood, Wilsonville,
Lake Oswego, West Linn, Happy Valley, Clackamas, Gresham, Troutdale,
Oregon City, Milwaukie, Forest Grove, Cornelius, North Plains, Vancouver,
Camas, Washougal, Ridgefield, Battle Ground, or La Center.

Locality names such as Bethany, North Bethany, Bonny Slope, or Cedar Mill are
within the Portland-area scope. When the official site uses one of those
locality names, return city as Portland so the website uses its canonical city.

Do NOT return a new community outside those supported cities. Exclude Salem,
Central Oregon, Seattle-area, Woodinville, and other distant markets even when
they appear on the builder's official website.

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

- If a community is NOT present in the supplied existingCommunities list, put
  it in newCommunities with the full structured record. Do NOT put a new name
  only in verifiedExistingNames, and do NOT put a new community in
  communityUpdates.
- Before adding a new community, confirm it is CURRENT or COMING SOON on the
  builder's current regional/community directory when such a directory exists.
  A stale detail page or old inventory URL by itself is not enough.
- Do NOT add a new community when the current official directory/page says
  Sold Out, Closed, Discontinued, No Longer Selling, or otherwise inactive.
- For a new community, use its dedicated official community page as sourceUrl
  whenever one exists. Do not use a different nearby community page merely
  because it mentions the community.
- If the official builder site uses a slightly different name for an existing
  community, preserve the supplied existing name when you can confidently
  identify the match.
- Do not collapse multiple existing child communities into a generic umbrella
  name. Example: if the existing data separately tracks a golf-course product
  and a townhome product, do not invent a third generic parent community.
- If a generic/umbrella name could refer to more than one supplied existing
  community, omit that generic record rather than guessing.

PRIORITY ORDER
1. Confirm existing communities quickly.
2. Capture obvious current incentives.
3. Capture useful details that are readily present on community pages.
4. Add clearly visible new communities.
5. Stop. Missing optional fields are acceptable.

Return only the structured result.
`;
}

function assertResearchResultShape(
  builder: NewConstructionBuilder,
  result: BuilderResearchResult,
): void {
  if (
    !result ||
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
}

function reconcileResearchResult(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
  directorySnapshot: BuilderDirectorySnapshot | null,
  communitySourcePages: Map<string, CommunitySourcePageSnapshot>,
): BuilderResearchResult {
  const verifiedExistingNames: string[] = [];
  const verifiedSeen = new Set<string>();
  const communityUpdates: CommunityResearchUpdate[] = [];
  const newCommunities: ResearchedCommunity[] = [];
  const removals: CommunityRemoval[] = [];
  const reconciliationNotes: string[] = [];

  /*
   * A verifiedExistingNames entry contains only a name.
   * If it does not resolve to an existing record, there is not enough
   * structured information to safely create a new community from it.
   * Ignore it rather than failing the builder's entire research result.
   */
  for (const rawName of result.verifiedExistingNames) {
    const existing = findExistingCommunityByName(
      rawName,
      existingCommunities,
    );

    if (!existing) {
      const note =
        `Ignored unknown name-only verification: ${rawName}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    if (!verifiedSeen.has(existing.name)) {
      verifiedSeen.add(existing.name);
      verifiedExistingNames.push(existing.name);
    }

    if (existing.name !== rawName) {
      const note =
        `Matched verified community "${rawName}" -> "${existing.name}".`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
    }
  }

  /*
   * A communityUpdate already contains the full structured record.
   * If it is not an existing community, treat it as a newly discovered
   * community instead of throwing away the builder's entire response.
   */
  for (const update of result.communityUpdates) {
    const existing = findExistingCommunityByName(
      update.name,
      existingCommunities,
    );

    if (existing) {
      if (existing.name !== update.name) {
        const note =
          `Matched community update "${update.name}" -> "${existing.name}".`;
        console.log(`${builder.name}: ${note}`);
        reconciliationNotes.push(note);
      }

      communityUpdates.push({
        ...update,
        name: existing.name,
      });
      continue;
    }

    const ambiguousMatches =
      findAmbiguousExistingCommunityMatches(
        update.name,
        existingCommunities,
      );

    if (ambiguousMatches.length > 1) {
      const note =
        `Ignored ambiguous umbrella community: ${update.name} — could match ${ambiguousMatches.map((community) => community.name).join(" | ")}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const canonicalCity = canonicalNewCommunityCity(update.city);

    if (!canonicalCity) {
      const note =
        `Ignored out-of-scope new community: ${update.name} — ${formatCommunityCity(update.city)}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const candidate = {
      ...update,
      city: canonicalCity,
    };

    if (looksLikeInactiveNewCommunity(candidate)) {
      const note =
        `Ignored inactive/sold-out new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    if (
      directorySnapshot &&
      isCommunityMarkedInactiveInDirectory(
        candidate,
        directorySnapshot,
      )
    ) {
      const note =
        `Ignored directory-inactive new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    if (
      isCommunityMarkedInactiveOnSourcePage(
        candidate,
        communitySourcePages,
      )
    ) {
      const note =
        `Ignored source-page-inactive new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const note =
      `Reclassified unknown community update as NEW: ${candidate.name}`;
    console.log(`${builder.name}: ${note}`);
    reconciliationNotes.push(note);
    newCommunities.push(candidate);
  }

  /*
   * Handle the inverse model mistake too: a "new" community may really be
   * an existing community under a punctuation/name variation.
   */
  for (const community of result.newCommunities) {
    const existing = findExistingCommunityByName(
      community.name,
      existingCommunities,
    );

    if (existing) {
      const note =
        `Reclassified new community as EXISTING update: ${community.name} -> ${existing.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);

      communityUpdates.push({
        ...community,
        name: existing.name,
      });
      continue;
    }

    const ambiguousMatches =
      findAmbiguousExistingCommunityMatches(
        community.name,
        existingCommunities,
      );

    if (ambiguousMatches.length > 1) {
      const note =
        `Ignored ambiguous umbrella community: ${community.name} — could match ${ambiguousMatches.map((item) => item.name).join(" | ")}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const canonicalCity = canonicalNewCommunityCity(community.city);

    if (!canonicalCity) {
      const note =
        `Ignored out-of-scope new community: ${community.name} — ${formatCommunityCity(community.city)}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const candidate = {
      ...community,
      city: canonicalCity,
    };

    if (looksLikeInactiveNewCommunity(candidate)) {
      const note =
        `Ignored inactive/sold-out new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    if (
      directorySnapshot &&
      isCommunityMarkedInactiveInDirectory(
        candidate,
        directorySnapshot,
      )
    ) {
      const note =
        `Ignored directory-inactive new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    if (
      isCommunityMarkedInactiveOnSourcePage(
        candidate,
        communitySourcePages,
      )
    ) {
      const note =
        `Ignored source-page-inactive new community: ${candidate.name}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    newCommunities.push(candidate);
  }

  const dedupedUpdates = dedupeCommunityRecords(
    communityUpdates,
  );
  const dedupedNewCommunities = dedupeCommunityRecords(
    newCommunities,
  );
  /*
   * Automated research never deletes an existing community. Builder websites
   * frequently leave stale pages, omit communities from directories, or expose
   * inconsistent sold-out messaging. Treat removals as review signals only.
   */
  for (const removal of result.removals) {
    const existing = findExistingCommunityByName(
      removal.name,
      existingCommunities,
    );

    if (existing) {
      const note =
        `Ignored automated removal pending manual review: ${existing.name} — ${removal.reason}`;
      console.log(`${builder.name}: ${note}`);
      reconciliationNotes.push(note);
      continue;
    }

    const note =
      `Ignored unknown removal: ${removal.name}`;
    console.log(`${builder.name}: ${note}`);
    reconciliationNotes.push(note);
  }

  return {
    ...result,
    verifiedExistingNames,
    communityUpdates: dedupedUpdates,
    removals,
    newCommunities: dedupedNewCommunities,
    researchNotes: [
      ...result.researchNotes,
      ...reconciliationNotes,
    ].slice(0, 24),
  };
}

function validateResearchResult(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
): void {
  assertResearchResultShape(builder, result);

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
        `${builder.name} research returned an unknown community update after reconciliation: ${update.name}`,
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
        `${builder.name} research returned an unknown removal after reconciliation: ${removal.name}`,
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

  const newNames = new Set<string>();
  for (const community of result.newCommunities) {
    const key = communityNameKey(community.name);

    if (!key) {
      throw new Error(
        `${builder.name} research returned a new community without a usable name.`,
      );
    }

    if (
      findExistingCommunityByName(
        community.name,
        existingCommunities,
      )
    ) {
      throw new Error(
        `${builder.name} research returned an existing community as new after reconciliation: ${community.name}`,
      );
    }

    if (
      findAmbiguousExistingCommunityMatches(
        community.name,
        existingCommunities,
      ).length > 1
    ) {
      throw new Error(
        `${builder.name} research returned an ambiguous umbrella community as new after reconciliation: ${community.name}`,
      );
    }

    if (newNames.has(key)) {
      throw new Error(
        `${builder.name} research returned duplicate new community: ${community.name}`,
      );
    }

    if (!isAllowedNewCommunityCity(community.city)) {
      throw new Error(
        `${builder.name} research returned an out-of-scope new community after reconciliation: ${community.name} — ${formatCommunityCity(community.city)}`,
      );
    }

    newNames.add(key);

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

function findExistingCommunityByName(
  value: string,
  existingCommunities: NewConstructionCommunity[],
): NewConstructionCommunity | null {
  if (!value) {
    return null;
  }

  const exact = existingCommunities.find(
    (community) => community.name === value,
  );

  if (exact) {
    return exact;
  }

  const targetKey = communityNameKey(value);
  if (!targetKey) {
    return null;
  }

  const normalizedMatches = existingCommunities.filter(
    (community) =>
      communityNameKey(community.name) === targetKey,
  );

  if (normalizedMatches.length === 1) {
    return normalizedMatches[0];
  }

  if (normalizedMatches.length > 1) {
    return null;
  }

  const targetTokens = communityNameTokens(value);
  if (targetTokens.length < 2) {
    return null;
  }

  const targetSet = new Set(targetTokens);

  /*
   * Do not guess when a parent/umbrella name could refer to multiple child
   * communities. Example: "The Nines at Camas Meadows" can refer to both the
   * golf-course homes and the townhomes.
   */
  const containingMatches =
    findAmbiguousExistingCommunityMatches(
      value,
      existingCommunities,
    );

  if (containingMatches.length > 1) {
    return null;
  }

  if (containingMatches.length === 1) {
    return containingMatches[0];
  }

  const candidates: Array<{
    community: NewConstructionCommunity;
    sizeGap: number;
    largerSize: number;
  }> = [];

  for (const community of existingCommunities) {
    const candidateTokens = communityNameTokens(
      community.name,
    );

    if (candidateTokens.length < 2) {
      continue;
    }

    const candidateSet = new Set(candidateTokens);
    let intersection = 0;

    for (const token of targetSet) {
      if (candidateSet.has(token)) {
        intersection += 1;
      }
    }

    const smallerSize = Math.min(
      targetSet.size,
      candidateSet.size,
    );
    const largerSize = Math.max(
      targetSet.size,
      candidateSet.size,
    );
    const sizeGap = largerSize - smallerSize;

    if (
      intersection === smallerSize &&
      smallerSize >= 2 &&
      sizeGap <= 2
    ) {
      candidates.push({
        community,
        sizeGap,
        largerSize,
      });
    }
  }

  if (candidates.length !== 1) {
    return null;
  }

  return candidates[0].community;
}

function findAmbiguousExistingCommunityMatches(
  value: string,
  existingCommunities: NewConstructionCommunity[],
): NewConstructionCommunity[] {
  const targetTokens = communityNameTokens(value);

  if (targetTokens.length < 2) {
    return [];
  }

  const targetSet = new Set(targetTokens);

  return existingCommunities.filter(
    (community) => {
      const candidateTokens = communityNameTokens(
        community.name,
      );

      if (candidateTokens.length <= targetTokens.length) {
        return false;
      }

      const candidateSet = new Set(candidateTokens);

      return [...targetSet].every(
        (token) => candidateSet.has(token),
      );
    },
  );
}

type ResearchCommunityRecord =
  | CommunityResearchUpdate
  | ResearchedCommunity;

function dedupeCommunityRecords<T extends ResearchCommunityRecord>(
  records: T[],
): T[] {
  const byName = new Map<string, T>();

  for (const record of records) {
    const key = communityNameKey(record.name);
    if (!key) {
      continue;
    }

    const existing = byName.get(key);
    if (
      !existing ||
      communityRecordScore(record) >
        communityRecordScore(existing)
    ) {
      byName.set(key, record);
    }
  }

  return [...byName.values()];
}

function communityRecordScore(
  record: ResearchCommunityRecord,
): number {
  let score = 0;

  if (record.city) score += 1;
  if (record.status) score += 1;
  if (record.homeType) score += 1;
  if (record.sourceUrl) score += 2;
  if (record.note) score += 1;

  const details = record.details;

  if (details.pricing?.text) score += 2;
  if (details.squareFeet?.text) score += 1;
  if (details.bedrooms?.text) score += 1;
  if (details.bathrooms?.text) score += 1;
  if (details.quickMoveInUrl) score += 1;
  if (details.modelHomeAddress) score += 1;

  score += Math.min(details.amenities?.length || 0, 3);
  score += Math.min(details.highlights?.length || 0, 3);
  score += Math.min((details.incentives?.length || 0) * 2, 6);

  return score;
}

function isAllowedNewCommunityCity(
  value: string,
): boolean {
  return canonicalNewCommunityCity(value) !== null;
}

function canonicalNewCommunityCity(
  value: string,
): string | null {
  const key = normalizeCityKey(value);

  if (!key) {
    return null;
  }

  const alias = NEW_COMMUNITY_CITY_ALIASES.get(key);
  if (alias) {
    return alias;
  }

  const canonical = ALLOWED_NEW_COMMUNITY_CITY_NAMES.find(
    (city) => normalizeCityKey(city) === key,
  );

  return canonical || null;
}

function normalizeCityKey(value: string): string {
  return String(value || "")
    .trim()
    .replace(
      /,\s*(OR|Oregon|WA|Washington)\s*$/i,
      "",
    )
    .replace(
      /\s+(OR|WA)\s*$/i,
      "",
    )
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCommunityCity(value: string): string {
  const city = String(value || "").trim();

  return city || "city unavailable";
}

async function loadBuilderDirectorySnapshot(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
): Promise<BuilderDirectorySnapshot | null> {
  const hasPotentialNewCommunity = [
    ...result.communityUpdates,
    ...result.newCommunities,
  ].some((community) => {
    if (
      findExistingCommunityByName(
        community.name,
        existingCommunities,
      )
    ) {
      return false;
    }

    return (
      findAmbiguousExistingCommunityMatches(
        community.name,
        existingCommunities,
      ).length <= 1
    );
  });

  if (!hasPotentialNewCommunity) {
    return null;
  }

  const urls = [
    builder.sourceUrl,
    builder.website,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) =>
      isOfficialUrl(
        value,
        builder.domain,
      ),
    )
    .filter(
      (value, index, values) =>
        values.indexOf(value) === index,
    )
    .slice(0, 2);

  if (urls.length === 0) {
    return null;
  }

  const pages = await Promise.all(
    urls.map((url) =>
      fetchOfficialHtmlPage(
        url,
        builder.domain,
        DIRECTORY_FETCH_MAX_BYTES,
        DIRECTORY_FETCH_TIMEOUT_MS,
      ),
    ),
  );

  const successful = pages.filter(
    (
      page,
    ): page is {
      url: string;
      html: string;
    } => Boolean(page),
  );

  if (successful.length === 0) {
    return null;
  }

  return {
    sourceUrls: successful.map(
      (page) => page.url,
    ),
    searchableText: successful
      .map((page) =>
        htmlToSearchableText(
          page.html,
        ),
      )
      .filter(Boolean)
      .join(" "),
  };
}

async function loadPotentialNewCommunitySourcePages(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
): Promise<Map<string, CommunitySourcePageSnapshot>> {
  const candidates = [
    ...result.communityUpdates,
    ...result.newCommunities,
  ].filter((community) => {
    if (
      findExistingCommunityByName(
        community.name,
        existingCommunities,
      )
    ) {
      return false;
    }

    if (
      findAmbiguousExistingCommunityMatches(
        community.name,
        existingCommunities,
      ).length > 1
    ) {
      return false;
    }

    if (!canonicalNewCommunityCity(community.city)) {
      return false;
    }

    if (!isOfficialUrl(community.sourceUrl, builder.domain)) {
      return false;
    }

    return true;
  });

  const uniqueUrls = [
    ...new Set(
      candidates
        .map((community) =>
          String(community.sourceUrl || "").trim(),
        )
        .filter(Boolean),
    ),
  ].slice(0, COMMUNITY_SOURCE_FETCH_MAX_PAGES);

  if (uniqueUrls.length === 0) {
    return new Map();
  }

  const pages = await mapWithConcurrency(
    uniqueUrls,
    COMMUNITY_SOURCE_FETCH_CONCURRENCY,
    async (url) =>
      fetchOfficialHtmlPage(
        url,
        builder.domain,
        COMMUNITY_SOURCE_FETCH_MAX_BYTES,
        COMMUNITY_SOURCE_FETCH_TIMEOUT_MS,
      ),
  );

  const snapshots = new Map<
    string,
    CommunitySourcePageSnapshot
  >();

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const requestedUrl = uniqueUrls[index];
    const page = pages[index];

    if (!page) {
      continue;
    }

    const searchableText =
      htmlToSearchableText(page.html);

    if (!searchableText) {
      continue;
    }

    snapshots.set(
      communitySourceUrlKey(requestedUrl),
      {
        requestedUrl,
        finalUrl: page.url,
        searchableText,
      },
    );
  }

  return snapshots;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      results[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          Math.max(1, concurrency),
          values.length,
        ),
      },
      () => runWorker(),
    ),
  );

  return results;
}

function isCommunityMarkedInactiveOnSourcePage(
  community: ResearchCommunityRecord,
  snapshots: Map<string, CommunitySourcePageSnapshot>,
): boolean {
  const sourceUrl = String(
    community.sourceUrl || "",
  ).trim();

  if (!sourceUrl) {
    return false;
  }

  const snapshot = snapshots.get(
    communitySourceUrlKey(sourceUrl),
  );

  if (!snapshot) {
    return false;
  }

  return isCommunityMarkedInactiveNearName(
    community.name,
    snapshot.searchableText,
    360,
  );
}

function communitySourceUrlKey(
  value: string,
): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

function isCommunityMarkedInactiveNearName(
  communityName: string,
  searchableText: string,
  distance: number,
): boolean {
  const name = normalizeDirectoryText(
    communityName,
  );

  if (!name || !searchableText) {
    return false;
  }

  const inactiveAlternation =
    DIRECTORY_INACTIVE_PHRASES
      .map((phrase) =>
        escapeRegExp(
          normalizeDirectoryText(phrase),
        ),
      )
      .join("|");

  if (!inactiveAlternation) {
    return false;
  }

  const escapedName =
    escapeRegExp(name);

  const forward = new RegExp(
    `${escapedName}.{0,${distance}}(?:${inactiveAlternation})`,
    "i",
  );

  const backward = new RegExp(
    `(?:${inactiveAlternation}).{0,${distance}}${escapedName}`,
    "i",
  );

  if (
    forward.test(searchableText) ||
    backward.test(searchableText)
  ) {
    return true;
  }

  /*
   * On a dedicated community page the H1/title may be separated from the
   * status badge in serialized HTML. If the community name appears near the
   * beginning of the rendered text and an inactive marker is also near the
   * beginning, treat that as explicit page-level inactivity.
   */
  const nameIndex =
    searchableText.indexOf(name);

  if (nameIndex === -1) {
    return false;
  }

  const pageLead =
    searchableText.slice(
      0,
      Math.min(
        searchableText.length,
        Math.max(
          nameIndex + name.length + 900,
          1800,
        ),
      ),
    );

  return DIRECTORY_INACTIVE_PHRASES.some(
    (phrase) =>
      pageLead.includes(
        normalizeDirectoryText(phrase),
      ),
  );
}

async function fetchOfficialHtmlPage(
  url: string,
  allowedDomain: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<{
  url: string;
  html: string;
} | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(
      url,
      {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept:
            "text/html,application/xhtml+xml",
          "user-agent":
            "Mozilla/5.0 (compatible; NewConstructionResearch/5.0)",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      contentType &&
      !contentType.toLowerCase().includes("text/html")
    ) {
      return null;
    }

    const finalUrl = response.url || url;

    if (!isOfficialUrl(finalUrl, allowedDomain)) {
      return null;
    }

    const html = await readResponseTextLimited(
      response,
      maxBytes,
    );

    if (!html) {
      return null;
    }

    return {
      url: response.url || url,
      html,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let html = "";
  let bytesRead = 0;

  try {
    while (bytesRead < maxBytes) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      if (!value?.byteLength) {
        continue;
      }

      const remaining =
        maxBytes - bytesRead;
      const chunk =
        value.byteLength > remaining
          ? value.subarray(0, remaining)
          : value;

      bytesRead += chunk.byteLength;
      html += decoder.decode(
        chunk,
        { stream: true },
      );
    }

    html += decoder.decode();
    return html;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation failures after the bounded read.
    }
  }
}

function isCommunityMarkedInactiveInDirectory(
  community: ResearchCommunityRecord,
  snapshot: BuilderDirectorySnapshot,
): boolean {
  return isCommunityMarkedInactiveNearName(
    community.name,
    snapshot.searchableText,
    140,
  );
}

function htmlToSearchableText(
  html: string,
): string {
  return normalizeDirectoryText(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"),
  );
}

function normalizeDirectoryText(
  value: string,
): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%$.,'&+\-/ ]+/g, " ")
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

function looksLikeInactiveNewCommunity(
  community: ResearchCommunityRecord,
): boolean {
  const text = [
    community.status,
    community.note,
    ...(community.details?.highlights || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /^(sold out|closed|discontinued|no longer selling)\b/.test(
      String(community.status || "").trim().toLowerCase(),
    ) ||
    /\bcommunity\b.{0,40}\b(sold out|closed|discontinued|no longer selling)\b/.test(
      text,
    )
  );
}

function communityNameKey(value: string): string {
  return communityNameTokens(value).join(" ");
}

function communityNameTokens(value: string): string[] {
  const ignored = new Set([
    "at",
    "by",
    "community",
    "communities",
    "home",
    "homes",
    "of",
    "phase",
    "the",
  ]);

  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !ignored.has(token));
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
