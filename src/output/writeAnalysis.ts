import fs from "node:fs/promises";
import path from "node:path";
import type { WeeklyAnalysis } from "../analysis/types.js";

export interface AnalysisOutputPaths {
  jsonPath: string;
  reportPath: string;
  scriptPath: string;
  instagramPath: string;
  youtubePath: string;
}

export async function writeAnalysisFiles(
  analysis: WeeklyAnalysis,
): Promise<AnalysisOutputPaths> {
  const outputDirectory = path.join(
    process.cwd(),
    "output",
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const instagramPath = path.join(
    outputDirectory,
    "instagram-caption.txt",
  );

  const youtubePath = path.join(
    outputDirectory,
    "youtube-shorts.txt",
  );

  const jsonPath = path.join(
    outputDirectory,
    "weekly-analysis.json",
  );

  const reportPath = path.join(
    outputDirectory,
    "weekly-report.md",
  );

  const scriptPath = path.join(
    outputDirectory,
    "reel-script.txt",
  );

  await Promise.all([
    fs.writeFile(
      jsonPath,
      JSON.stringify(analysis, null, 2),
      "utf8",
    ),
    fs.writeFile(
      reportPath,
      createMarkdownReport(analysis),
      "utf8",
    ),
    fs.writeFile(
      scriptPath,
      `${analysis.reelScript.trim()}\n`,
      "utf8",
    ),
    fs.writeFile(
      instagramPath,
      `${analysis.instagramCaption.trim()}\n`,
      "utf8",
    ),
    fs.writeFile(
      youtubePath,
      createYoutubeFile(analysis),
      "utf8",
    ),
  ]);

  return {
    jsonPath,
    reportPath,
    scriptPath,
    instagramPath,
    youtubePath,
  };
}

function createMarkdownReport(
  analysis: WeeklyAnalysis,
): string {
  const listingSections = analysis.selectedListings
    .sort((a, b) => a.rank - b.rank)
    .map(
      (listing) => `
## ${listing.rank}. ${listing.address}

- **MLS:** ${listing.mlsNumber}
- **Current price:** ${formatCurrency(listing.currentPrice)}
- **Exact price reduction:** ${listing.exactDropPlaceholder}
- **Why it made the cut:** ${listing.shortReason}
- **Concern:** ${listing.concern}
- **Suggested line:** ${listing.spokenLine}
`,
    )
    .join("\n");

  const factChecks = analysis.factCheckNotes
    .map((note) => `- ${note}`)
    .join("\n");

  return `# ${analysis.title}

${analysis.summary}

${listingSections}

# Reel Script

${analysis.reelScript}

# Final Fact Check

${factChecks}

# Instagram Caption

${analysis.instagramCaption}

# YouTube Shorts Title

${analysis.youtubeShortsTitle}

# YouTube Shorts Description

${analysis.youtubeShortsDescription}

# YouTube Keywords

${analysis.youtubeKeywords}
`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function createYoutubeFile(
  analysis: WeeklyAnalysis,
): string {
  return [
    "YOUTUBE SHORTS TITLE",
    "====================",
    "",
    analysis.youtubeShortsTitle,
    "",
    "YOUTUBE SHORTS DESCRIPTION",
    "==========================",
    "",
    analysis.youtubeShortsDescription,
    "",
    "KEYWORDS",
    "========",
    "",
    analysis.youtubeKeywords,
    "",
  ].join("\n");
}