import fs from "node:fs/promises";
import path from "node:path";

export type HistoricalSnapshotType =
  | "market-stats"
  | "price-drops";

export async function saveHistoricalSnapshot(
  type: HistoricalSnapshotType,
  data: unknown,
  date = new Date(),
): Promise<string> {
  const snapshotDate =
    getPortlandDate(
      date,
    );

  const year =
    snapshotDate.slice(
      0,
      4,
    );

  const directory =
    path.join(
      process.cwd(),
      "data",
      type,
      year,
    );

  await fs.mkdir(
    directory,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      directory,
      `${snapshotDate}.json`,
    );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      data,
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `Saved historical ${type} snapshot: ${outputPath}`,
  );

  return outputPath;
}

function getPortlandDate(
  date: Date,
): string {
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
      date,
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Could not determine Portland snapshot date.",
    );
  }

  return `${year}-${month}-${day}`;
}