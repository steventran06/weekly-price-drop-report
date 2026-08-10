import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

const raw = await fs.readFile(packagePath, "utf8");
const pkg = JSON.parse(raw);

pkg.scripts ||= {};
pkg.scripts["new-construction"] =
  "tsx src/newConstruction/index.ts";
pkg.scripts["new-construction:dry-run"] =
  "NEW_CONSTRUCTION_DRY_RUN=true tsx src/newConstruction/index.ts";

await fs.writeFile(
  packagePath,
  `${JSON.stringify(pkg, null, 2)}\n`,
  "utf8",
);

console.log("# New Construction Research v5 Installer");
console.log("");
console.log("✓ Added/updated npm run new-construction");
console.log("✓ Added/updated npm run new-construction:dry-run");
console.log("✓ No dependencies were added or changed");
console.log("✓ One LOW-reasoning research call per builder");
console.log("✓ LOW web-search context");
console.log("✓ No high-reasoning fallback");
console.log("✓ No automatic OpenAI retries");
console.log("✓ Default research timeout reduced to 60 seconds per builder");
console.log("✓ Builder failure/timeout does not stop the full run");
console.log("✓ Missing optional community facts no longer fail validation");
console.log("✓ Adds 9 requested tracked builders when missing");
console.log("✓ Stone Bridge Homes NW remains the existing tracked builder");
console.log("✓ Default builder concurrency: 2 (max 2)");
console.log("✓ Community images fetched from official community page metadata without an AI image call");
console.log("✓ Website falls back to builder logo when no community image is available");
