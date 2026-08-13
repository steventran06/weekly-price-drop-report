import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const packagePath = path.join(
  projectRoot,
  "package.json",
);

const raw = await fs.readFile(
  packagePath,
  "utf8",
);

const packageJson = JSON.parse(
  raw,
);

packageJson.scripts ??= {};

packageJson.scripts["reddit-alerts"] =
  "tsx src/redditAlerts/index.ts";
packageJson.scripts["reddit-alerts:dry-run"] =
  "REDDIT_ALERTS_DRY_RUN=true tsx src/redditAlerts/index.ts";
packageJson.scripts["reddit-alerts:test"] =
  "tsx src/redditAlerts/testNotification.ts";

await fs.writeFile(
  packagePath,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  "Added Reddit alert scripts to package.json:",
);
console.log(
  "- npm run reddit-alerts",
);
console.log(
  "- npm run reddit-alerts:dry-run",
);
console.log(
  "- npm run reddit-alerts:test",
);
