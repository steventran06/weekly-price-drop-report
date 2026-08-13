/*
 * Backwards-compatible re-export.
 * Price-drop-specific Gmail logic now lives with
 * the weeklyPriceDrops workflow.
 */
export {
  findPriceDropEmails,
} from "../weeklyPriceDrops/findPriceDropEmails.js";

export type {
  PriceDropEmail,
} from "../weeklyPriceDrops/findPriceDropEmails.js";
