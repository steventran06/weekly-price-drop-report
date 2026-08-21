import type {
  GeneratedMarketStatsContent,
} from "../../marketStats/generateMarketStatsContent.js";

import type {
  MarketStatsAnalysis,
} from "../../marketStats/analyzeMarketStats.js";

import type {
  ExtractedMarketStats,
} from "../../marketStats/extractMarketStats.js";

import {
  buildMarketStatsCarousel,
} from "./buildMarketStatsCarousel.js";

import {
  getInstagramAutomationConfig,
} from "./config.js";

import {
  publishInstagramCarousel,
} from "./instagramClient.js";

import {
  publishInstagramAssetsToGitHub,
} from "./publishAssetsToGitHub.js";

import {
  renderInstagramCarousel,
} from "./renderCarousel.js";

import {
  waitForPublicAssets,
} from "./waitForPublicAssets.js";

import type {
  RenderedInstagramCarousel,
} from "./types.js";

export async function generateAndMaybePublishMarketStatsInstagram(
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
  content: GeneratedMarketStatsContent,
): Promise<RenderedInstagramCarousel | null> {
  const config =
    getInstagramAutomationConfig();

  if (!config.enabled) {
    console.log("");
    console.log(
      "Instagram generation disabled (INSTAGRAM_ENABLED=false).",
    );
    return null;
  }

  console.log("");
  console.log(
    "Generating Portland Home Guide Instagram carousel...",
  );

  const definition =
    buildMarketStatsCarousel(
      stats,
      analysis,
      content,
    );

  const rendered =
    await renderInstagramCarousel(
      definition,
      config,
    );

  console.log(
    `Instagram carousel rendered: ${rendered.outputDirectory}`,
  );

  for (
    const imagePath
    of rendered.imagePaths
  ) {
    console.log(
      `- ${imagePath}`,
    );
  }

  if (!config.autoPublish) {
    console.log(
      "Instagram auto-publish is OFF. The generated JPEGs will be attached to the weekly market-stats email for manual posting.",
    );
    return rendered;
  }

  if (!config.assetBaseUrl) {
    throw new Error(
      "INSTAGRAM_ASSET_BASE_URL is required when INSTAGRAM_AUTO_PUBLISH=true.",
    );
  }

  if (
    !config.userId ||
    !config.accessToken
  ) {
    throw new Error(
      "INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN are required when INSTAGRAM_AUTO_PUBLISH=true.",
    );
  }

  const publishedAssets =
    await publishInstagramAssetsToGitHub(
      rendered.imagePaths,
      rendered.slug,
      config.assetBaseUrl,
      config.githubPath,
    );

  console.log(
    `Published Instagram assets in one GitHub commit: ${publishedAssets.commitUrl}`,
  );

  await waitForPublicAssets(
    publishedAssets.imageUrls,
  );

  const mediaId =
    await publishInstagramCarousel({
      apiVersion:
        config.apiVersion,
      userId:
        config.userId,
      accessToken:
        config.accessToken,
      imageUrls:
        publishedAssets.imageUrls,
      caption:
        rendered.caption,
    });

  console.log(
    `Instagram carousel published. Media ID: ${mediaId}`,
  );

  return rendered;
}
