import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import {
  resolve,
} from "node:path";

import type {
  WebsiteMortgageRates,
} from "./types.js";

export async function writeMortgageRatesPreview(
  data: WebsiteMortgageRates,
): Promise<string> {
  const directory =
    resolve(
      "output/mortgage-rates",
    );
  const filePath =
    resolve(
      directory,
      "latest.json",
    );

  await mkdir(
    directory,
    {
      recursive: true,
    },
  );

  await writeFile(
    filePath,
    JSON.stringify(
      data,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return filePath;
}
