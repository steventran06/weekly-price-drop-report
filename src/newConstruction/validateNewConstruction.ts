import {
  isOfficialUrl,
} from "./researchBuilder.js";
import type {
  NewConstructionData,
  NewConstructionIncentive,
  ResearchAudit,
} from "./types.js";

export function validateFinalNewConstruction(
  previous: NewConstructionData,
  next: NewConstructionData,
  audits: ResearchAudit[],
): void {
  if (next.builders.length !== previous.builders.length) {
    throw new Error(
      "Automated research is not allowed to add/remove builders. Update the builder list manually.",
    );
  }

  const builderById = new Map(
    next.builders.map((builder) => [builder.id, builder]),
  );

  for (const builder of next.builders) {
    for (const incentive of builder.incentives || []) {
      validateIncentive(
        incentive,
        builder.domain,
        `${builder.name} builder incentive`,
      );
    }
  }

  for (const community of next.communities) {
    const builder = builderById.get(community.builderId);

    if (!builder) {
      throw new Error(
        `Final new-construction feed contains unknown builder ${community.builderId}.`,
      );
    }

    // Keep the public feed useful without forcing optional enrichment.
    // Status, home type, pricing, beds/baths, HOA, incentives, hours and
    // images are all allowed to be blank when the official builder site
    // does not provide them cleanly.
    if (
      !community.name ||
      !community.city ||
      !community.citySlug ||
      !community.sourceUrl ||
      !community.lastVerified
    ) {
      throw new Error(
        `Final new-construction feed contains a community missing a core field for ${builder.name}: ${community.name || "unnamed community"}.`,
      );
    }

    if (!isOfficialUrl(community.sourceUrl, builder.domain)) {
      throw new Error(
        `Final new-construction feed contains a non-official source for ${community.name}: ${community.sourceUrl}`,
      );
    }

    if (community.imageUrl) {
      try {
        const image = new URL(community.imageUrl);
        if (image.protocol !== "http:" && image.protocol !== "https:") {
          throw new Error("unsupported protocol");
        }
      } catch {
        throw new Error(
          `Final new-construction feed contains an invalid image URL for ${community.name}: ${community.imageUrl}`,
        );
      }

      if (
        !community.imageSourceUrl ||
        !isOfficialUrl(community.imageSourceUrl, builder.domain)
      ) {
        throw new Error(
          `Final new-construction feed contains an invalid image source page for ${community.name}: ${community.imageSourceUrl || "missing"}`,
        );
      }
    }

    const details = community.details;

    if (details?.quickMoveInUrl && !isOfficialUrl(details.quickMoveInUrl, builder.domain)) {
      throw new Error(
        `Final new-construction feed contains a non-official quick-move-in URL for ${community.name}.`,
      );
    }

    for (const incentive of details?.incentives || []) {
      validateIncentive(
        incentive,
        builder.domain,
        `${community.name} incentive`,
      );
    }
  }

  const maxChangePercent = readPercent(
    process.env.NEW_CONSTRUCTION_MAX_COMMUNITY_CHANGE_PERCENT,
    35,
  );

  const oldCount = previous.communities.length;
  const newCount = next.communities.length;
  const changePercent =
    oldCount === 0
      ? 0
      : Math.abs(newCount - oldCount) / oldCount * 100;

  if (changePercent > maxChangePercent) {
    throw new Error(
      `New-construction community count changed ${changePercent.toFixed(1)}% (${oldCount} -> ${newCount}), exceeding the ${maxChangePercent}% safety threshold. Refusing to publish.`,
    );
  }

  const totalRemoved = audits.reduce(
    (sum, audit) => sum + audit.removed,
    0,
  );
  const maxRemovals = readInteger(
    process.env.NEW_CONSTRUCTION_MAX_REMOVALS_PER_RUN,
    8,
  );

  if (totalRemoved > maxRemovals) {
    throw new Error(
      `Research proposed ${totalRemoved} removals, exceeding the ${maxRemovals}-community safety threshold. Refusing to publish.`,
    );
  }
}

function validateIncentive(
  incentive: NewConstructionIncentive,
  builderDomain: string,
  label: string,
): void {
  if (!isOfficialUrl(incentive.sourceUrl, builderDomain)) {
    throw new Error(
      `${label} contains a non-official source URL: ${incentive.sourceUrl}`,
    );
  }

  if (
    incentive.expirationDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(incentive.expirationDate)
  ) {
    throw new Error(
      `${label} contains an invalid expiration date: ${incentive.expirationDate}`,
    );
  }
}

function readPercent(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function readInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}
