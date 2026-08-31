#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const target = path.resolve(
  process.cwd(),
  "src/mortgageRates/fetchFredMortgageRates.ts",
);

if (!fs.existsSync(target)) {
  console.error(
    "Could not find src/mortgageRates/fetchFredMortgageRates.ts.\n" +
      "Run this script from the root of weekly-price-drop-report.",
  );
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

if (source.includes("FRED_FETCH_RETRY_PATCH_V1")) {
  console.log("Mortgage-rate resilience patch is already applied.");
  process.exit(0);
}

const original = source;

/*
 * 1) Increase the FRED request timeout from 15 seconds to 30 seconds.
 *    Prefer a FRED-named timeout constant; otherwise update a unique
 *    15_000 timeout constant in this file.
 */
const fredTimeoutPattern =
  /(const\s+[A-Z0-9_]*FRED[A-Z0-9_]*TIMEOUT[A-Z0-9_]*\s*=\s*)15_000(\s*;)/;

if (fredTimeoutPattern.test(source)) {
  source = source.replace(fredTimeoutPattern, "$130_000$2");
} else {
  const timeout15Matches = [
    ...source.matchAll(
      /const\s+([A-Z0-9_]*TIMEOUT[A-Z0-9_]*)\s*=\s*15_000\s*;/g,
    ),
  ];

  if (timeout15Matches.length === 1) {
    const full = timeout15Matches[0][0];
    source = source.replace(full, full.replace("15_000", "30_000"));
  } else if (timeout15Matches.length === 0) {
    console.warn(
      "⚠ Did not find a 15_000 timeout constant. " +
        "Retry behavior will still be added, but verify the existing timeout manually.",
    );
  } else {
    console.warn(
      "⚠ Found multiple 15_000 timeout constants and did not change them automatically.",
    );
  }
}

/*
 * 2) Reduce FRED request concurrency to 3 when a clearly FRED-named
 *    concurrency constant exists and is currently above 3.
 */
source = source.replace(
  /(const\s+[A-Z0-9_]*FRED[A-Z0-9_]*CONCURRENCY[A-Z0-9_]*\s*=\s*)(\d+)(\s*;)/,
  (match, prefix, value, suffix) => {
    const current = Number(value);
    return current > 3 ? `${prefix}3${suffix}` : match;
  },
);

/*
 * 3) Add three-attempt retry behavior around the existing
 *    fetchSeriesPoint implementation without changing its signature
 *    or the callers elsewhere in the file.
 */
const declarationPattern = /async\s+function\s+fetchSeriesPoint\s*\(/;

if (!declarationPattern.test(source)) {
  console.error(
    "Could not find `async function fetchSeriesPoint(` in the target file.\n" +
      "No changes were written.",
  );
  process.exit(1);
}

source = source.replace(
  declarationPattern,
  "async function fetchSeriesPointOnce(",
);

const retryWrapper = `
// FRED_FETCH_RETRY_PATCH_V1
const FRED_FETCH_MAX_ATTEMPTS = 3;

async function fetchSeriesPoint(
  ...args: Parameters<typeof fetchSeriesPointOnce>
): Promise<Awaited<ReturnType<typeof fetchSeriesPointOnce>>> {
  let lastError: unknown;

  const firstArg = args[0] as unknown;
  const seriesLabel =
    typeof firstArg === "string"
      ? firstArg
      : firstArg &&
          typeof firstArg === "object" &&
          ("seriesId" in firstArg ||
            "fredSeriesId" in firstArg ||
            "id" in firstArg)
        ? String(
            (firstArg as {
              seriesId?: unknown;
              fredSeriesId?: unknown;
              id?: unknown;
            }).seriesId ??
              (firstArg as { fredSeriesId?: unknown }).fredSeriesId ??
              (firstArg as { id?: unknown }).id ??
              "FRED series",
          )
        : "FRED series";

  for (
    let attempt = 1;
    attempt <= FRED_FETCH_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await fetchSeriesPointOnce(...args);
    } catch (error) {
      lastError = error;

      if (attempt >= FRED_FETCH_MAX_ATTEMPTS) {
        break;
      }

      const delayMs = 1_000 * 2 ** (attempt - 1);
      const message =
        error instanceof Error ? error.message : String(error);

      console.warn(
        \`\${seriesLabel}: attempt \${attempt}/\${FRED_FETCH_MAX_ATTEMPTS} failed (\${message}). Retrying in \${delayMs / 1_000}s...\`,
      );

      await new Promise<void>((resolve) =>
        setTimeout(resolve, delayMs),
      );
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : String(lastError);

  throw new Error(
    \`\${seriesLabel} failed after \${FRED_FETCH_MAX_ATTEMPTS} attempts: \${message}\`,
  );
}

`;

const renamedIndex = source.indexOf(
  "async function fetchSeriesPointOnce(",
);

if (renamedIndex === -1) {
  console.error(
    "Could not insert retry wrapper safely.\nNo changes were written.",
  );
  process.exit(1);
}

source =
  source.slice(0, renamedIndex) +
  retryWrapper +
  source.slice(renamedIndex);

if (source === original) {
  console.error("Patch made no changes.");
  process.exit(1);
}

const backup = `${target}.before-fred-retry-patch`;
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, original, "utf8");
}

fs.writeFileSync(target, source, "utf8");

console.log("");
console.log("✓ Patched src/mortgageRates/fetchFredMortgageRates.ts");
console.log("  - FRED fetches now retry up to 3 times");
console.log("  - Retry delays are 1s, then 2s");
console.log("  - 15s FRED timeout changed to 30s when safely detected");
console.log("  - FRED concurrency reduced to 3 when safely detected");
console.log("");
console.log(
  "Backup: src/mortgageRates/fetchFredMortgageRates.ts.before-fred-retry-patch",
);
console.log("");
console.log("Next run:");
console.log("  npm run mortgage-rates");
