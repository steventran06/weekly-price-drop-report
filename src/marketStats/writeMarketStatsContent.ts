import fs from "node:fs/promises";
import path from "node:path";

import type {
  GeneratedMarketStatsContent,
} from "./generateMarketStatsContent.js";

import type {
  MarketStatsBlogPost,
} from "./generateMarketStatsBlog.js";

export interface MarketStatsOutputPaths {
  blogPath: string;
  reelPath: string;
  instagramPath: string;
  googleBusinessPostPath: string;
  youtubePath: string;
  contentJsonPath: string;
}

export async function writeMarketStatsContent(
  content: GeneratedMarketStatsContent,
  blog: MarketStatsBlogPost,
): Promise<MarketStatsOutputPaths> {
  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const blogPath =
    path.join(
      outputDirectory,
      blog.filename,
    );

  const reelPath =
    path.join(
      outputDirectory,
      "reel-script.txt",
    );

  const instagramPath =
    path.join(
      outputDirectory,
      "instagram-caption.txt",
    );

  const googleBusinessPostPath =
    path.join(
      outputDirectory,
      "google-business-post.txt",
    );

  const youtubePath =
    path.join(
      outputDirectory,
      "youtube-shorts.txt",
    );

  const contentJsonPath =
    path.join(
      outputDirectory,
      "generated-content.json",
    );

  await Promise.all([
    fs.writeFile(
      blogPath,
      blog.markdown,
      "utf8",
    ),

    fs.writeFile(
      reelPath,
      content.reelScript,
      "utf8",
    ),

    fs.writeFile(
      instagramPath,
      content.instagramCaption,
      "utf8",
    ),

    fs.writeFile(
      googleBusinessPostPath,
      content.googleBusinessPost + "\n",
      "utf8",
    ),

    fs.writeFile(
      youtubePath,
      [
        "TITLE",
        "=====",
        "",
        content.youtubeShortsTitle,
        "",
        "DESCRIPTION",
        "===========",
        "",
        content.youtubeShortsDescription,
        "",
        "KEYWORDS",
        "========",
        "",
        content.youtubeKeywords.join(", "),
        "",
      ].join("\n"),
      "utf8",
    ),

    fs.writeFile(
      contentJsonPath,
      JSON.stringify(
        content,
        null,
        2,
      ),
      "utf8",
    ),
  ]);

  return {
    blogPath,
    reelPath,
    instagramPath,
    googleBusinessPostPath,
    youtubePath,
    contentJsonPath,
  };
}