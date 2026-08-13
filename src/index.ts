/*
 * Backwards-compatible entry point.
 *
 * The weekly price-drop workflow now lives in
 * src/weeklyPriceDrops/index.ts. The package.json
 * "weekly" script points there directly.
 */
import "./weeklyPriceDrops/index.js";
