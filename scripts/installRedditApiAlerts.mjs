import fs from "node:fs/promises";
import path from "node:path";

const packagePath = path.resolve("package.json");
const raw = await fs.readFile(packagePath, "utf8");
const pkg = JSON.parse(raw);

pkg.scripts ??= {};

const scripts = {
  "reddit-alerts": "tsx src/redditAlerts/index.ts",
  "reddit-alerts:dry-run": "REDDIT_ALERTS_DRY_RUN=true tsx src/redditAlerts/index.ts",
  "reddit-alerts:test": "tsx src/redditAlerts/testNotification.ts",
  "reddit-alerts:api-test": "tsx src/redditAlerts/testRedditApi.ts",
  "reddit-alerts:filter-test": "tsx src/redditAlerts/testFilters.ts",
};

for (const [name, command] of Object.entries(scripts)) {
  pkg.scripts[name] = command;
}

await fs.writeFile(
  packagePath,
  `${JSON.stringify(pkg, null, 2)}\n`,
  "utf8",
);

console.log("Installed Reddit OAuth alert scripts:");
for (const name of Object.keys(scripts)) {
  console.log(`- npm run ${name}`);
}
