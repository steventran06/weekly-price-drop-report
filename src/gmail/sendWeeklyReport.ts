/*
 * Backwards-compatible re-export.
 * The weekly price-drop email sender now lives with
 * the weeklyPriceDrops workflow.
 */
export {
  sendWeeklyReport,
} from "../weeklyPriceDrops/sendWeeklyReport.js";
