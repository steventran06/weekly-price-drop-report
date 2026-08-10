import {
  clearVolatileDetails,
  emptyCommunityDetails,
} from "./researchBuilder.js";
import type {
  BuilderResearchResult,
  NewConstructionBuilder,
  NewConstructionCommunity,
  NewConstructionCommunityDetails,
  NewConstructionIncentive,
  ResearchAudit,
} from "./types.js";

export function mergeBuilderResearch(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  result: BuilderResearchResult,
  verifiedDate: string,
): {
  builder: NewConstructionBuilder;
  communities: NewConstructionCommunity[];
  audit: ResearchAudit;
} {
  const verified = new Set(result.verifiedExistingNames);
  const updates = new Map(
    result.communityUpdates.map((item) => [item.name, item]),
  );
  const removals = new Map(
    result.removals.map((item) => [item.name, item]),
  );

  const merged: NewConstructionCommunity[] = [];
  let kept = 0;
  let updated = 0;
  let removed = 0;
  let uncertain = 0;

  for (const existing of existingCommunities) {
    if (removals.has(existing.name)) {
      removed += 1;
      continue;
    }

    const update = updates.get(existing.name);

    if (update) {
      updated += 1;
      merged.push(
        mergeVerifiedCommunity(
          existing,
          update,
          verifiedDate,
        ),
      );
      continue;
    }

    if (verified.has(existing.name)) {
      kept += 1;
      merged.push({
        ...existing,
        lastVerified: verifiedDate,
        details: clearVolatileDetails(existing.details),
      });
      continue;
    }

    uncertain += 1;
    merged.push({
      ...existing,
      details: clearVolatileDetails(existing.details),
    });
  }

  let added = 0;
  const seen = new Set(
    merged.map((community) => communityKey(community)),
  );

  for (const community of result.newCommunities) {
    const candidate: NewConstructionCommunity = {
      builderId: builder.id,
      name: clean(community.name),
      city: clean(community.city),
      citySlug: slugify(community.city),
      status: clean(community.status),
      homeType: clean(community.homeType),
      sourceUrl: clean(community.sourceUrl),
      lastVerified: verifiedDate,
      note: clean(community.note),
      details: normalizeDetails(community.details),
    };

    if (!candidate.name || !candidate.city || !candidate.citySlug) {
      throw new Error(
        `${builder.name} research returned a new community without a valid name/city.`,
      );
    }

    const key = communityKey(candidate);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(candidate);
    added += 1;
  }

  merged.sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      a.name.localeCompare(b.name),
  );

  const builderIncentives = normalizeIncentives(
    result.builderIncentives,
    verifiedDate,
  );

  const communityIncentiveCount = merged.reduce(
    (sum, community) =>
      sum + (community.details?.incentives.length || 0),
    0,
  );

  return {
    builder: {
      ...builder,
      incentives: builderIncentives,
      lastVerified: verifiedDate,
    },
    communities: merged,
    audit: {
      builderId: builder.id,
      builderName: builder.name,
      previousCount: existingCommunities.length,
      finalCount: merged.length,
      kept,
      updated,
      removed,
      uncertain,
      added,
      builderIncentiveCount: builderIncentives.length,
      communityIncentiveCount,
      failed: false,
      error: "",
      notes: [
        ...result.removals.map(
          (item) => `Removed ${item.name}: ${item.reason}`,
        ),
        ...result.researchNotes,
      ],
    },
  };
}

export function preserveBuilderAfterResearchFailure(
  builder: NewConstructionBuilder,
  existingCommunities: NewConstructionCommunity[],
  error: unknown,
): {
  builder: NewConstructionBuilder;
  communities: NewConstructionCommunity[];
  audit: ResearchAudit;
} {
  const errorMessage = formatError(error);

  return {
    builder: {
      ...builder,
      incentives: [],
    },
    communities: existingCommunities.map((community) => ({
      ...community,
      details: clearVolatileDetails(community.details),
    })),
    audit: {
      builderId: builder.id,
      builderName: builder.name,
      previousCount: existingCommunities.length,
      finalCount: existingCommunities.length,
      kept: 0,
      updated: 0,
      removed: 0,
      uncertain: existingCommunities.length,
      added: 0,
      builderIncentiveCount: 0,
      communityIncentiveCount: 0,
      failed: true,
      error: errorMessage,
      notes: [
        "Research call failed or timed out. Basic directory records were preserved. Volatile pricing, quick-move-in, HOA, sales-hour and incentive data were not carried forward as current facts.",
      ],
    },
  };
}

function mergeVerifiedCommunity(
  existing: NewConstructionCommunity,
  update: BuilderResearchResult["communityUpdates"][number],
  verifiedDate: string,
): NewConstructionCommunity {
  const city = clean(update.city) || existing.city;

  return {
    ...existing,
    city,
    citySlug: slugify(city) || existing.citySlug,
    status: clean(update.status) || existing.status,
    homeType: clean(update.homeType) || existing.homeType,
    sourceUrl: clean(update.sourceUrl) || existing.sourceUrl,
    note: clean(update.note),
    details: normalizeDetails(update.details),
    lastVerified: verifiedDate,
  };
}

function normalizeDetails(
  details: NewConstructionCommunityDetails | undefined,
): NewConstructionCommunityDetails {
  const fallback = emptyCommunityDetails();

  if (!details) {
    return fallback;
  }

  return {
    pricing: {
      from: numberOrNull(details.pricing?.from),
      to: numberOrNull(details.pricing?.to),
      text: clean(details.pricing?.text),
    },
    squareFeet: normalizeRange(details.squareFeet),
    bedrooms: normalizeRange(details.bedrooms),
    bathrooms: normalizeRange(details.bathrooms),
    floorPlanCount: numberOrNull(details.floorPlanCount),
    quickMoveInCount: numberOrNull(details.quickMoveInCount),
    quickMoveInUrl: clean(details.quickMoveInUrl),
    modelHomeAddress: clean(details.modelHomeAddress),
    salesOfficeHours: clean(details.salesOfficeHours),
    hoa: {
      amount: numberOrNull(details.hoa?.amount),
      frequency: clean(details.hoa?.frequency),
      text: clean(details.hoa?.text),
    },
    amenities: uniqueStrings(details.amenities).slice(0, 8),
    highlights: uniqueStrings(details.highlights).slice(0, 6),
    incentives: normalizeIncentives(details.incentives, ""),
  };
}

function normalizeRange(
  value: NewConstructionCommunityDetails["squareFeet"] | undefined,
): NewConstructionCommunityDetails["squareFeet"] {
  return {
    min: numberOrNull(value?.min),
    max: numberOrNull(value?.max),
    text: clean(value?.text),
  };
}

function normalizeIncentives(
  incentives: NewConstructionIncentive[] | undefined,
  fallbackVerifiedAt: string,
): NewConstructionIncentive[] {
  if (!Array.isArray(incentives)) {
    return [];
  }

  return incentives
    .map((incentive) => ({
      headline: clean(incentive.headline),
      description: clean(incentive.description),
      type: incentive.type,
      amount: numberOrNull(incentive.amount),
      interestRate: clean(incentive.interestRate),
      appliesTo: clean(incentive.appliesTo),
      requirements: clean(incentive.requirements),
      expirationDate: clean(incentive.expirationDate),
      sourceUrl: clean(incentive.sourceUrl),
      verifiedAt:
        clean(incentive.verifiedAt) || fallbackVerifiedAt,
    }))
    .filter(
      (incentive) =>
        incentive.headline && incentive.sourceUrl,
    );
}

function communityKey(
  community: Pick<NewConstructionCommunity, "name" | "city">,
): string {
  return `${normalize(community.name)}|${normalize(community.city)}`;
}

function normalize(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    const cleaned = clean(item);
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
