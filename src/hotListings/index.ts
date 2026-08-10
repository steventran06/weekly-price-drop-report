import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { authorize } from "../gmail/auth.js";
import { fetchRmlsReport } from "../rmls/fetchReport.js";
import { publishWebsiteHotListings } from "../website/publishWebsiteHotListings.js";
import { buildWebsiteHotListings } from "./buildWebsiteHotListings.js";
import { enrichListings } from "./enrichListings.js";
import { findLatestNewOnMarketEmail } from "./findNewOnMarketEmail.js";
import { parseSourceListings } from "./parseSourceListings.js";
import { scoreListings } from "./scoreListings.js";
import {
  loadRollingHotListings,
  mergeRollingHotListings,
  saveRollingHotListings,
} from "./rollingCache.js";

dotenv.config();

async function main() {
  console.log("================================");
  console.log(" Daily Hot Listings");
  console.log("================================");

  validateHotListingsEnvironment();
  logHotListingsConfiguration();

  console.log("Authenticating...");
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  const email = await findLatestNewOnMarketEmail(gmail);

  console.log("Fetching RMLS report...");
  const report = await fetchRmlsReport(email.reportUrl);

  if (!report.html) {
    throw new Error("RMLS report fetch returned no HTML.");
  }

  const sourceListings = await parseSourceListings(report.html);
  console.log(`Parsed ${sourceListings.length} RMLS listing(s) from the selected report.`);

  const sourceEmailAt = new Date(email.internalDate).toISOString();
  const enrichedIncoming = enrichListings(
    sourceListings,
    report.html,
    email.reportUrl,
  );

  const existingCache = await loadRollingHotListings();
  const rollingListings = mergeRollingHotListings(
    existingCache,
    enrichedIncoming,
    sourceEmailAt,
  );

  await saveRollingHotListings(rollingListings);

  console.log(
    `Rolling candidate pool: ${rollingListings.length} listing(s) after merge/prune.`,
  );

  const scored = scoreListings(rollingListings);
  const payload = buildWebsiteHotListings(
    scored,
    sourceListings.length,
    sourceEmailAt,
    rollingListings.length,
  );

  const outputDir = path.resolve("output", "hot-listings");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "hot-listings.json");
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Hot listing diagnostics");
  console.log("-----------------------");
  console.log(`Source email: ${payload.sourceEmailAt}`);
  console.log(`Source report listings: ${payload.diagnostics.sourceListings}`);
  console.log(`Rolling candidate pool: ${payload.diagnostics.rollingListings}`);
  console.log(`Eligible listings: ${payload.diagnostics.eligibleListings}`);
  console.log(`Mapped to city: ${payload.diagnostics.mappedToCity}`);
  console.log(`With image: ${payload.diagnostics.withImage}`);
  console.log(`With multiple images: ${payload.diagnostics.withMultipleImages}`);
  console.log(`With neighborhood: ${payload.diagnostics.withNeighborhood}`);
  console.log(`With public remarks: ${payload.diagnostics.withRemarks}`);
  console.log(`With brokerage: ${payload.diagnostics.withBrokerage}`);
  console.log(`Selected for city feeds: ${payload.diagnostics.selectedListings}`);
  console.log(`Cities: ${Object.keys(payload.cities).length}`);
  console.log(`Local output: ${outputPath}`);
  console.log(`Public display enabled: ${payload.publicDisplayEnabled}`);

  const publishedUrl = await publishWebsiteHotListings(payload);
  if (publishedUrl) console.log(`Published: ${publishedUrl}`);

  console.log("Hot listings workflow completed.");
}

function validateHotListingsEnvironment(): void {
  const shouldPublish =
    /^true$/i.test(process.env.HOT_LISTINGS_PUBLISH?.trim() ?? "false");

  if (shouldPublish && !process.env.SITE_GITHUB_TOKEN?.trim()) {
    throw new Error(
      "HOT_LISTINGS_PUBLISH=true requires SITE_GITHUB_TOKEN.",
    );
  }
}

function logHotListingsConfiguration(): void {
  const owner = process.env.SITE_GITHUB_OWNER?.trim() || "steventran06";
  const repo = process.env.SITE_GITHUB_REPO?.trim() || "steventranrealestate";
  const branch = process.env.SITE_GITHUB_BRANCH?.trim() || "main";
  const feedPath =
    process.env.SITE_HOT_LISTINGS_PATH?.trim() || "data/hot-listings.json";
  const cachePath =
    process.env.SITE_HOT_LISTINGS_CACHE_PATH?.trim() ||
    "data/hot-listings-source-cache.json";
  const cacheHours = process.env.HOT_LISTINGS_CACHE_HOURS?.trim() || "168";
  const shouldPublish =
    /^true$/i.test(process.env.HOT_LISTINGS_PUBLISH?.trim() ?? "false");
  const publicDisplay =
    /^true$/i.test(process.env.HOT_LISTINGS_PUBLIC_DISPLAY?.trim() ?? "false");

  console.log("");
  console.log("Hot Listings configuration");
  console.log("--------------------------");
  console.log(`Publish to GitHub: ${shouldPublish}`);
  console.log(`Public display: ${publicDisplay}`);
  console.log(`GitHub destination: ${owner}/${repo} (${branch})`);
  console.log(`Feed path: ${feedPath}`);
  console.log(`Cache path: ${cachePath}`);
  console.log(`Rolling cache: ${cacheHours} hours`);
}

main().catch((error) => {
  console.error("");
  console.error("Hot listings workflow failed.");
  console.error(error);
  process.exitCode = 1;
});
