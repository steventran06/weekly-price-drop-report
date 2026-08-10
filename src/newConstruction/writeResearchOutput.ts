import fs from "node:fs/promises";
import path from "node:path";
import type {
  NewConstructionData,
  ResearchAudit,
} from "./types.js";

export async function writeResearchOutput(
  data: NewConstructionData,
  audits: ResearchAudit[],
): Promise<void> {
  const outDir = path.join(
    process.cwd(),
    "output",
    "new-construction",
  );

  await fs.mkdir(outDir, {
    recursive: true,
  });

  await Promise.all([
    fs.writeFile(
      path.join(outDir, "new-construction.json"),
      `${JSON.stringify(data, null, 2)}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(outDir, "research-audit.json"),
      `${JSON.stringify(audits, null, 2)}\n`,
      "utf8",
    ),
  ]);

  console.log("");
  console.log(
    `Saved preview: ${path.join(outDir, "new-construction.json")}`,
  );
  console.log(
    `Saved audit: ${path.join(outDir, "research-audit.json")}`,
  );
}
