import dotenv from "dotenv";
import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import {
  join,
} from "node:path";

import {
  loadWebsiteNewConstruction,
  publishWebsiteNewConstruction,
} from "./githubNewConstruction.js";
import {
  enrichCommunityImages,
} from "./communityImages.js";
import {
  mergeBuilderResearch,
  preserveBuilderAfterResearchFailure,
} from "./mergeResearch.js";
import {
  researchBuilder,
} from "./researchBuilder.js";
import {
  ensureTrackedBuilders,
} from "./trackedBuilders.js";
import {
  validateFinalNewConstruction,
} from "./validateNewConstruction.js";
import {
  writeResearchOutput,
} from "./writeResearchOutput.js";
import type {
  NewConstructionBuilder,
  NewConstructionCommunity,
  NewConstructionData,
  ResearchAudit,
} from "./types.js";

dotenv.config();

interface BuilderWorkResult {
  builder: NewConstructionBuilder;
  communities: NewConstructionCommunity[];
  audit: ResearchAudit;
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log(" New Construction Research v5");
  console.log("========================================");
  console.log("");
  console.log("Research mode: official builder websites only");
  console.log("Reasoning effort: LOW");
  console.log("Web-search context: LOW");
  console.log("Research passes per builder: 1");
  console.log("High-reasoning fallback: DISABLED");
  console.log("SDK retries: DISABLED");
  console.log(
    "Community images: direct official-page metadata fetch, no AI call",
  );

  const dryRun =
    process.env.NEW_CONSTRUCTION_DRY_RUN?.trim().toLowerCase() ===
    "true";

  const {
    data: websiteData,
    context,
  } = await loadWebsiteNewConstruction();

  const tracked = ensureTrackedBuilders(websiteData);
  const previous = tracked.data;

  console.log("");
  console.log(
    `Loaded ${websiteData.builders.length} builders and ${websiteData.communities.length} communities from the website repo.`,
  );

  if (tracked.addedBuilders.length > 0) {
    console.log(
      `Added ${tracked.addedBuilders.length} tracked builder(s) to this working run: ` +
        tracked.addedBuilders
          .map((builder) => builder.name)
          .join(", "),
    );
  }

  console.log(
    `Builders researched this run: ${previous.builders.length}`,
  );

  const verifiedDate = getPacificDate();
  const concurrency = readConcurrency();

  console.log(
    `Builder research concurrency: ${concurrency}`,
  );

  const work = previous.builders.map(
    (builder) => async (): Promise<BuilderWorkResult> => {
      const existing =
        previous.communities.filter(
          (community) =>
            community.builderId === builder.id,
        );

      try {
        const research =
          await researchBuilder(
            builder,
            existing,
            verifiedDate,
          );

        const merged =
          mergeBuilderResearch(
            builder,
            existing,
            research,
            verifiedDate,
          );

        console.log(
          `${builder.name}: ${existing.length} -> ${merged.communities.length} ` +
            `(verified ${merged.audit.kept}, updated ${merged.audit.updated}, ` +
            `added ${merged.audit.added}, removed ${merged.audit.removed}, ` +
            `not freshly verified ${merged.audit.uncertain}, ` +
            `incentives ${
              merged.audit.builderIncentiveCount +
              merged.audit.communityIncentiveCount
            })`,
        );

        return merged;
      } catch (error) {
        const preserved =
          preserveBuilderAfterResearchFailure(
            builder,
            existing,
            error,
          );

        console.warn("");
        console.warn(
          `${builder.name}: research failed/timed out; moving on.`,
        );
        console.warn(
          `  ${preserved.audit.error}`,
        );

        return preserved;
      }
    },
  );

  const results =
    await runWithConcurrency(
      work,
      concurrency,
    );

  const builders =
    results.map(
      (item) => item.builder,
    );

  const audits =
    results.map(
      (item) => item.audit,
    );

  const mergedCommunities =
    results
      .flatMap(
        (item) =>
          item.communities,
      )
      .sort(
        (a, b) =>
          a.city.localeCompare(
            b.city,
          ) ||
          a.builderId.localeCompare(
            b.builderId,
          ) ||
          a.name.localeCompare(
            b.name,
          ),
      );

  const imageResult =
    await enrichCommunityImages(
      builders,
      mergedCommunities,
    );

  const communities =
    imageResult.communities;

  const next: NewConstructionData = {
    ...previous,

    schemaVersion:
      Math.max(
        Number(
          previous.schemaVersion ||
            1,
        ),
        3,
      ),

    lastVerified:
      verifiedDate,

    builders,

    communities,

    feedMeta: {
      ...(previous.feedMeta ||
        {}),

      source:
        "automated-official-builder-research-v5",

      researchedAt:
        new Date().toISOString(),

      researchDate:
        verifiedDate,

      researchMethod:
        "One low-reasoning, low-context OpenAI Responses API web-search call per tracked builder, restricted to the builder official domain. No high-reasoning fallback and no SDK retries. Missing optional facts are omitted instead of chased. Community card images are read directly from official community-page social metadata with no additional AI call.",

      trackedBuilderRegistryVersion:
        1,

      trackedBuilderCount:
        previous.builders.length,

      failedBuilderCount:
        audits.filter(
          (audit) =>
            audit.failed,
        ).length,

      uncertainCommunityCount:
        audits.reduce(
          (sum, audit) =>
            sum +
            audit.uncertain,
          0,
        ),

      builderIncentiveCount:
        audits.reduce(
          (sum, audit) =>
            sum +
            audit.builderIncentiveCount,
          0,
        ),

      communityIncentiveCount:
        audits.reduce(
          (sum, audit) =>
            sum +
            audit.communityIncentiveCount,
          0,
        ),

      communityImageCount:
        imageResult.stats.found,

      communityLogoFallbackCount:
        imageResult.stats.fallback,

      communityImageFetchFailureCount:
        imageResult.stats.fetchFailures,

      communityImagePagesFetched:
        imageResult.stats.uniquePagesFetched,
    },
  };

  /*
   * Validate before replacing the normal preview/publish output.
   *
   * If validation rejects the candidate, save that rejected candidate
   * separately so it can be inspected without weakening the safety gate
   * or overwriting the last good preview.
   */
  try {
    validateFinalNewConstruction(
      previous,
      next,
      audits,
    );
  } catch (error) {
    const rejectedPaths =
      await writeRejectedResearchOutput(
        next,
        audits,
      );

    console.error("");
    console.error(
      "Final new-construction validation rejected this candidate.",
    );
    console.error(
      `Saved rejected candidate: ${rejectedPaths.dataPath}`,
    );
    console.error(
      `Saved rejected audit: ${rejectedPaths.auditPath}`,
    );

    printAuditSummary(
      audits,
    );

    throw error;
  }

  await writeResearchOutput(
    next,
    audits,
  );

  printAuditSummary(
    audits,
  );

  if (dryRun) {
    console.log("");
    console.log(
      "DRY RUN: completed. Nothing was published to GitHub.",
    );

    return;
  }

  console.log("");
  console.log(
    "Publishing data/new-construction.json to the website repository...",
  );

  const url =
    await publishWebsiteNewConstruction(
      next,
      context,
    );

  console.log(
    "Published successfully:",
  );
  console.log(
    url,
  );
}

async function writeRejectedResearchOutput(
  data: NewConstructionData,
  audits: ResearchAudit[],
): Promise<{
  dataPath: string;
  auditPath: string;
}> {
  const outputDir =
    join(
      process.cwd(),
      "output",
      "new-construction",
    );

  await mkdir(
    outputDir,
    {
      recursive: true,
    },
  );

  const dataPath =
    join(
      outputDir,
      "rejected-new-construction.json",
    );

  const auditPath =
    join(
      outputDir,
      "rejected-research-audit.json",
    );

  await Promise.all([
    writeFile(
      dataPath,
      `${JSON.stringify(
        data,
        null,
        2,
      )}\n`,
      "utf8",
    ),

    writeFile(
      auditPath,
      `${JSON.stringify(
        audits,
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  return {
    dataPath,
    auditPath,
  };
}

function printAuditSummary(
  audits: ResearchAudit[],
): void {
  const totals =
    audits.reduce(
      (acc, audit) => ({
        kept:
          acc.kept +
          audit.kept,

        updated:
          acc.updated +
          audit.updated,

        removed:
          acc.removed +
          audit.removed,

        uncertain:
          acc.uncertain +
          audit.uncertain,

        added:
          acc.added +
          audit.added,

        failed:
          acc.failed +
          (
            audit.failed
              ? 1
              : 0
          ),

        builderIncentives:
          acc.builderIncentives +
          audit.builderIncentiveCount,

        communityIncentives:
          acc.communityIncentives +
          audit.communityIncentiveCount,
      }),

      {
        kept: 0,
        updated: 0,
        removed: 0,
        uncertain: 0,
        added: 0,
        failed: 0,
        builderIncentives: 0,
        communityIncentives: 0,
      },
    );

  console.log("");
  console.log(
    "Research summary",
  );
  console.log(
    "----------------",
  );
  console.log(
    `Verified unchanged: ${totals.kept}`,
  );
  console.log(
    `Updated with current details: ${totals.updated}`,
  );
  console.log(
    `New: ${totals.added}`,
  );
  console.log(
    `Removed: ${totals.removed}`,
  );
  console.log(
    `Not freshly verified: ${totals.uncertain}`,
  );
  console.log(
    `Builder calls failed/skipped: ${totals.failed}`,
  );
  console.log(
    `Builder-wide incentives found: ${totals.builderIncentives}`,
  );
  console.log(
    `Community incentives found: ${totals.communityIncentives}`,
  );
}

async function runWithConcurrency<T>(
  tasks: Array<
    () => Promise<T>
  >,
  concurrency: number,
): Promise<T[]> {
  const results =
    new Array<T>(
      tasks.length,
    );

  let nextIndex =
    0;

  async function worker(): Promise<void> {
    while (
      true
    ) {
      const index =
        nextIndex;

      nextIndex +=
        1;

      if (
        index >=
        tasks.length
      ) {
        return;
      }

      results[index] =
        await tasks[
          index
        ]();
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            tasks.length,
          ),
      },
      () =>
        worker(),
    ),
  );

  return results;
}

function readConcurrency(): number {
  const value =
    Number(
      process.env.NEW_CONSTRUCTION_RESEARCH_CONCURRENCY ||
        2,
    );

  if (
    !Number.isInteger(
      value,
    ) ||
    value <
      1
  ) {
    return 2;
  }

  return Math.min(
    value,
    2,
  );
}

function getPacificDate(): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Los_Angeles",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal",
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ],
        ),
    );

  return `${values.year}-${values.month}-${values.day}`;
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "New-construction research failed.",
    );
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
