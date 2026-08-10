import fs from "node:fs/promises";
import path from "node:path";
import type { SourceListing } from "./types.js";

const LEGACY_RMLS_REPORT_PATH =
  path.resolve(
    "output",
    "rmls-report.html",
  );

export async function parseSourceListings(
  html: string,
): Promise<SourceListing[]> {
  const module = (await import("../rmls/parseListings.js")) as Record<
    string,
    unknown
  >;

  /*
   * Prefer parsers that actually accept the HTML we just fetched.
   */
  const directParserNames = [
    "parseRmlsReportHtml",
    "parseListings",
    "parseRmlsListings",
    "parseRmlsReport",
  ];

  for (const name of directParserNames) {
    if (typeof module[name] !== "function") {
      continue;
    }

    console.log(
      `Using existing RMLS parser: ${name}`,
    );

    const result =
      await (
        module[name] as (
          html: string,
        ) => unknown
      )(html);

    return normalizeParserResult(
      result,
      name,
    );
  }

  /*
   * The existing price-drop parser exports parseSavedRmlsReport().
   *
   * That legacy function does NOT parse the HTML argument. It reads:
   *
   *   output/rmls-report.html
   *
   * directly from disk.
   *
   * For hot listings, stage the NEW ON MARKET HTML at that legacy path,
   * invoke the parser, then restore the previous file afterward.
   *
   * This lets us reuse the proven parser without changing the
   * PRICE DROP workflow.
   */
  if (
    typeof module.parseSavedRmlsReport ===
    "function"
  ) {
    console.log(
      "Using existing RMLS parser: parseSavedRmlsReport",
    );
    console.log(
      "Staging NEW ON MARKET HTML for the legacy saved-report parser...",
    );

    return withLegacyReportHtml(
      html,
      async () => {
        const result =
          await (
            module.parseSavedRmlsReport as (
              ...args: unknown[]
            ) => unknown
          )();

        return normalizeParserResult(
          result,
          "parseSavedRmlsReport",
        );
      },
    );
  }

  if (
    typeof module.default ===
    "function"
  ) {
    console.log(
      "Using existing RMLS parser: default",
    );

    const result =
      await (
        module.default as (
          html: string,
        ) => unknown
      )(html);

    return normalizeParserResult(
      result,
      "default",
    );
  }

  throw new Error(
    `Could not find the RMLS parser export. Available exports: ${Object.keys(module).join(", ")}`,
  );
}

async function withLegacyReportHtml<T>(
  html: string,
  callback: () => Promise<T> | T,
): Promise<T> {
  await fs.mkdir(
    path.dirname(
      LEGACY_RMLS_REPORT_PATH,
    ),
    {
      recursive: true,
    },
  );

  let previousContents:
    string | null = null;

  let previousFileExisted =
    false;

  try {
    previousContents =
      await fs.readFile(
        LEGACY_RMLS_REPORT_PATH,
        "utf8",
      );

    previousFileExisted =
      true;
  } catch (
    error
  ) {
    if (
      !isEnoent(
        error,
      )
    ) {
      throw error;
    }
  }

  await fs.writeFile(
    LEGACY_RMLS_REPORT_PATH,
    html,
    "utf8",
  );

  try {
    return await callback();
  } finally {
    if (
      previousFileExisted &&
      previousContents !== null
    ) {
      await fs.writeFile(
        LEGACY_RMLS_REPORT_PATH,
        previousContents,
        "utf8",
      );
    } else {
      await fs.rm(
        LEGACY_RMLS_REPORT_PATH,
        {
          force: true,
        },
      );
    }
  }
}

function normalizeParserResult(
  result: unknown,
  parserName: string,
): SourceListing[] {
  if (
    Array.isArray(
      result,
    )
  ) {
    return result as SourceListing[];
  }

  if (
    result &&
    typeof result ===
      "object"
  ) {
    const record =
      result as Record<
        string,
        unknown
      >;

    const possibleListingKeys = [
      "listings",
      "properties",
      "results",
    ];

    for (
      const key
      of possibleListingKeys
    ) {
      if (
        Array.isArray(
          record[key],
        )
      ) {
        return record[key] as SourceListing[];
      }
    }
  }

  const resultType =
    result === null
      ? "null"
      : Array.isArray(
            result,
          )
        ? "array"
        : typeof result;

  const resultKeys =
    result &&
    typeof result ===
      "object" &&
    !Array.isArray(
      result,
    )
      ? Object.keys(
          result as Record<
            string,
            unknown
          >,
        ).join(", ")
      : "";

  throw new Error(
    `The existing RMLS parser ${parserName} did not return a listing array.` +
      ` Result type: ${resultType}.` +
      (
        resultKeys
          ? ` Result keys: ${resultKeys}`
          : ""
      ),
  );
}

function isEnoent(
  error: unknown,
): boolean {
  return (
    error !== null &&
    typeof error ===
      "object" &&
    "code" in error &&
    (
      error as {
        code?: unknown;
      }
    ).code ===
      "ENOENT"
  );
}
