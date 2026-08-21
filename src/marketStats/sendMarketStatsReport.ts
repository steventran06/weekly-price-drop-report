import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { gmail_v1 } from "googleapis";

import type {
  ExtractedMarketStats,
  MarketStats,
} from "./extractMarketStats.js";

import type {
  MarketStatsAnalysis,
  MarketRanking,
} from "./analyzeMarketStats.js";

import type {
  GeneratedMarketStatsContent,
} from "./generateMarketStatsContent.js";

import type {
  MarketStatsBlogPost,
} from "./generateMarketStatsBlog.js";

const PRIMARY_RECIPIENT =
  process.env.REPORT_RECIPIENT?.trim() ||
  "steven@diverserg.com";

const RECIPIENTS = [
  PRIMARY_RECIPIENT,
  "alex@diverserg.com",
];

export async function sendMarketStatsReport(
  gmail: gmail_v1.Gmail,
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
  content: GeneratedMarketStatsContent,
  blog: MarketStatsBlogPost,
  instagramImagePaths: string[] = [],
): Promise<string> {
  const subject =
    createSubject(
      analysis.reportDate,
    );

  const textBody =
    createTextEmailBody(
      stats,
      analysis,
      content,
      blog,
    );

  const htmlBody =
    createHtmlEmailBody(
      stats,
      analysis,
      content,
      blog,
    );

  const mixedBoundary =
    `weekly-market-stats-mixed-${Date.now()}`;

  const alternativeBoundary =
    `weekly-market-stats-alt-${Date.now()}`;

  const attachmentParts =
    await buildJpegAttachmentParts(
      instagramImagePaths,
      mixedBoundary,
    );

  const mimeMessage = [
    `To: ${RECIPIENTS.join(", ")}`,
    `From: ${PRIMARY_RECIPIENT}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
    ...attachmentParts,
    `--${mixedBoundary}--`,
  ].join("\r\n");

  const raw =
    Buffer.from(
      mimeMessage,
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  const response =
    await gmail.users.messages.send({
      userId: "me",

      requestBody: {
        raw,
      },
    });

  if (
    !response.data.id
  ) {
    throw new Error(
      "Gmail reported success but did not return a message ID.",
    );
  }

  return response.data.id;
}

async function buildJpegAttachmentParts(
  imagePaths: string[],
  mixedBoundary: string,
): Promise<string[]> {
  const jpegPaths =
    imagePaths.filter((imagePath) =>
      /\.jpe?g$/i.test(imagePath),
    );

  const parts: string[] = [];

  for (const imagePath of jpegPaths) {
    const filename =
      basename(imagePath);

    const file =
      await readFile(imagePath);

    const base64 =
      file
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") ?? "";

    parts.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: image/jpeg; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      base64,
    );
  }

  return parts;
}

function createSubject(
  reportDate: string | null,
): string {
  if (reportDate) {
    return (
      `Portland Metro Market Stats - ${reportDate}`
    );
  }

  const date =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Los_Angeles",
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    ).format(new Date());

  return (
    `Portland Metro Market Stats - ${date}`
  );
}

function createTextEmailBody(
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
  content: GeneratedMarketStatsContent,
  blog: MarketStatsBlogPost,
): string {
  const blogUrl =
    createPublicBlogUrl(
      blog.slug,
    );

  const metroSingleFamily =
    analysis.metroAggregate;

  const metroCondo =
    findMetroCondo(
      stats,
    );

  const hottestMarkets =
    createTextRanking(
      analysis.hottestSingleFamily,
    );

  const buyerOpportunities =
    createTextRanking(
      analysis.strongestBuyerOpportunities,
    );

  const condoOpportunities =
    createTextRanking(
      analysis.strongestCondoBuyerOpportunities,
    );

  const condoGaps =
    analysis.condoVsSingleFamily
      .slice(0, 5)
      .map(
        (comparison) =>
          [
            cleanAreaName(
              comparison.area,
            ),
            `Single Family: ${formatInventory(
              comparison.singleFamilyInventory,
            )}`,
            `Condo: ${formatInventory(
              comparison.condoInventory,
            )}`,
            `Gap: ${formatInventory(
              comparison.inventoryGap,
            )}`,
          ].join(" | "),
      )
      .join("\n");

  const marketSummary =
    createTextMarketSummary(
      stats,
    );

  const storyBlurb =
    createMarketStatsStoryBlurb(
      analysis,
      metroCondo,
    );

  return [
    "PORTLAND METRO MARKET STATS",
    "",
    `Report date: ${analysis.reportDate ?? "Unknown"}`,
    "",
    "BLOG",
    "====",
    "",
    content.blogTitle,
    blogUrl,
    "",
    "GREATER PORTLAND SNAPSHOT",
    "=========================",
    "",
    createTextMetroSummary(
      metroSingleFamily,
      metroCondo,
    ),
    "",
    "INSTAGRAM STORY BLURB",
    "=====================",
    "",
    storyBlurb,
    "",
    "MOST COMPETITIVE SINGLE-FAMILY MARKETS",
    "======================================",
    "",
    hottestMarkets,
    "",
    "STRONGEST SINGLE-FAMILY BUYER OPPORTUNITIES",
    "============================================",
    "",
    buyerOpportunities,
    "",
    "STRONGEST CONDO BUYER OPPORTUNITIES",
    "===================================",
    "",
    condoOpportunities,
    "",
    "CONDO VS SINGLE-FAMILY INVENTORY",
    "================================",
    "",
    condoGaps,
    "",
    "REEL SCRIPT",
    "===========",
    "",
    content.reelScript,
    "",
    "INSTAGRAM CAPTION",
    "=================",
    "",
    content.instagramCaption,
    "",
    "YOUTUBE SHORTS TITLE",
    "====================",
    "",
    content.youtubeShortsTitle,
    "",
    "YOUTUBE SHORTS DESCRIPTION",
    "==========================",
    "",
    content.youtubeShortsDescription,
    "",
    "YOUTUBE KEYWORDS",
    "================",
    "",
    content.youtubeKeywords.join(
      ", ",
    ),
    "",
    "FULL MARKET SUMMARY",
    "===================",
    "",
    marketSummary,
    "",
    "Generated automatically from the weekly TMO Reports PDF.",
  ].join("\n");
}

function createHtmlEmailBody(
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
  content: GeneratedMarketStatsContent,
  blog: MarketStatsBlogPost,
): string {
  const blogUrl =
    createPublicBlogUrl(
      blog.slug,
    );

  const metroSingleFamily =
    analysis.metroAggregate;

  const metroCondo =
    findMetroCondo(
      stats,
    );

  const hottestMarkets =
    createHtmlRanking(
      analysis.hottestSingleFamily,
    );

  const buyerOpportunities =
    createHtmlRanking(
      analysis.strongestBuyerOpportunities,
    );

  const condoOpportunities =
    createHtmlRanking(
      analysis.strongestCondoBuyerOpportunities,
    );

  const storyBlurb =
    createMarketStatsStoryBlurb(
      analysis,
      metroCondo,
    );

  const condoComparisonRows =
    analysis.condoVsSingleFamily
      .slice(0, 5)
      .map(
        (comparison) => `
<tr>
  <td style="${tableCellStyle()}">
    ${escapeHtml(
      cleanAreaName(
        comparison.area,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatInventory(
        comparison.singleFamilyInventory,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatInventory(
        comparison.condoInventory,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatInventory(
        comparison.inventoryGap,
      ),
    )}
  </td>
</tr>`,
      )
      .join("");

  const fullMarketRows =
    createHtmlMarketRows(
      stats,
    );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>

<body style="
  font-family: Arial, Helvetica, sans-serif;
  line-height: 1.5;
  color: #222222;
  max-width: 760px;
  margin: 0 auto;
  padding: 24px;
">

  <h1 style="
    margin: 0 0 8px 0;
    font-size: 26px;
  ">
    Portland Metro Market Stats
  </h1>

  <p style="
    margin-top: 0;
    color: #666666;
  ">
    Report date:
    <strong>
      ${escapeHtml(
        analysis.reportDate ??
          "Unknown",
      )}
    </strong>
  </p>

  <hr style="${dividerStyle()}">

  <h2>
    Weekly Market Blog
  </h2>

  <p style="
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 8px;
  ">
    ${escapeHtml(
      content.blogTitle,
    )}
  </p>

  <p>
    <a
      href="${escapeHtml(
        blogUrl,
      )}"
      target="_blank"
      rel="noopener noreferrer"
      style="
        color: #1155cc;
        text-decoration: underline;
        font-weight: 600;
      "
    >
      Open the published market update
    </a>
  </p>

  <hr style="${dividerStyle()}">

  <h2>
    Greater Portland Snapshot
  </h2>

  ${createHtmlMetroSnapshot(
    metroSingleFamily,
    metroCondo,
  )}

  <hr style="${dividerStyle()}">

  <h2>
    Instagram Story Blurb
  </h2>

  ${createCopyBox(
    storyBlurb,
  )}

  <hr style="${dividerStyle()}">

  <h2>
    Most Competitive Single-Family Markets
  </h2>

  <p style="
    color: #555555;
    margin-bottom: 20px;
  ">
    Markets ranked primarily by lower months of inventory,
    with pending activity and days on market used as supporting indicators.
  </p>

  ${hottestMarkets}

  <hr style="${dividerStyle()}">

  <h2>
    Strongest Single-Family Buyer Opportunities
  </h2>

  <p style="
    color: #555555;
    margin-bottom: 20px;
  ">
    Areas with more inventory and longer marketing times may give
    buyers more selection and negotiating flexibility.
  </p>

  ${buyerOpportunities}

  <hr style="${dividerStyle()}">

  <h2>
    Strongest Condo Buyer Opportunities
  </h2>

  ${condoOpportunities}

  <hr style="${dividerStyle()}">

  <h2>
    Condo vs. Single-Family Inventory
  </h2>

  <div style="
    overflow-x: auto;
  ">
    <table
      cellpadding="0"
      cellspacing="0"
      style="
        border-collapse: collapse;
        width: 100%;
        font-size: 14px;
      "
    >
      <thead>
        <tr>
          <th style="${tableHeaderStyle()}">
            Area
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Single Family
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Condo
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Gap
          </th>
        </tr>
      </thead>

      <tbody>
        ${condoComparisonRows}
      </tbody>
    </table>
  </div>

  <hr style="${dividerStyle()}">

  <h2>
    Reel Script
  </h2>

  ${createCopyBox(
    content.reelScript,
  )}

  <hr style="${dividerStyle()}">

  <h2>
    Instagram Caption
  </h2>

  ${createCopyBox(
    content.instagramCaption,
  )}

  <hr style="${dividerStyle()}">

  <h2>
    YouTube Shorts Title
  </h2>

  ${createCopyBox(
    content.youtubeShortsTitle,
  )}

  <h2 style="
    margin-top: 28px;
  ">
    YouTube Shorts Description
  </h2>

  ${createCopyBox(
    content.youtubeShortsDescription,
  )}

  <h2 style="
    margin-top: 28px;
  ">
    YouTube Keywords
  </h2>

  ${createCopyBox(
    content.youtubeKeywords.join(
      ", ",
    ),
  )}

  <hr style="${dividerStyle()}">

  <h2>
    Full Market Summary
  </h2>

  <p style="
    color: #555555;
  ">
    This is the full set of extracted market totals from the TMO report.
  </p>

  <div style="
    overflow-x: auto;
  ">
    <table
      cellpadding="0"
      cellspacing="0"
      style="
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
      "
    >
      <thead>
        <tr>
          <th style="${tableHeaderStyle()}">
            Area
          </th>

          <th style="${tableHeaderStyle()}">
            Type
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Active
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Pending
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Inventory
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Avg Sale
          </th>

          <th style="${tableHeaderStyle(
            true,
          )}">
            Sold DOM
          </th>
        </tr>
      </thead>

      <tbody>
        ${fullMarketRows}
      </tbody>
    </table>
  </div>

  <hr style="${dividerStyle()}">

  <p style="
    font-size: 12px;
    color: #777777;
  ">
    Generated automatically from the weekly TMO Reports PDF.
  </p>

</body>
</html>
`;
}

function createMarketStatsStoryBlurb(
  analysis: MarketStatsAnalysis,
  metroCondo: MarketStats | null,
): string {
  const metroSingleFamily =
    analysis.metroAggregate;

  const hottest =
    analysis.hottestSingleFamily[0];

  const lines = [
    "New Portland Metro housing market update 📊",
    "",
  ];

  if (
    metroSingleFamily
  ) {
    lines.push(
      `Single-family homes are sitting at ${formatInventory(
        metroSingleFamily.monthsOfInventory,
      )} of inventory with an average of ${formatDays(
        metroSingleFamily.averageDaysOnMarketSold,
      )} on market.`,
    );
  }

  if (
    metroCondo
  ) {
    lines.push(
      `Condos are much looser at ${formatInventory(
        metroCondo.monthsOfInventory,
      )} of inventory.`,
    );
  }

  if (
    hottest
  ) {
    lines.push(
      "",
      `${cleanAreaName(
        hottest.area,
      )} is one of the most competitive single-family markets this week at ${formatInventory(
        hottest.monthsOfInventory,
      )} of inventory.`,
    );
  }

  lines.push(
    "",
    "Full Portland Metro breakdown is on steventranrealestate.com.",
  );

  return lines.join("\n");
}

function createTextMetroSummary(
  singleFamily: MarketStats | null,
  condo: MarketStats | null,
): string {
  const sections: string[] = [];

  if (singleFamily) {
    sections.push(
      [
        "SINGLE FAMILY",
        `Active: ${formatNumber(
          singleFamily.activeListings,
        )}`,
        `Pending: ${formatNumber(
          singleFamily.pendingListings,
        )}`,
        `Pending ratio: ${formatPercent(
          singleFamily.pendingActiveRatio,
        )}`,
        `Inventory: ${formatInventory(
          singleFamily.monthsOfInventory,
        )}`,
        `Average sale price: ${formatCurrency(
          singleFamily.averageSalePrice,
        )}`,
        `Sold DOM: ${formatDays(
          singleFamily.averageDaysOnMarketSold,
        )}`,
      ].join("\n"),
    );
  }

  if (condo) {
    sections.push(
      [
        "CONDOS",
        `Active: ${formatNumber(
          condo.activeListings,
        )}`,
        `Pending: ${formatNumber(
          condo.pendingListings,
        )}`,
        `Pending ratio: ${formatPercent(
          condo.pendingActiveRatio,
        )}`,
        `Inventory: ${formatInventory(
          condo.monthsOfInventory,
        )}`,
        `Average sale price: ${formatCurrency(
          condo.averageSalePrice,
        )}`,
        `Sold DOM: ${formatDays(
          condo.averageDaysOnMarketSold,
        )}`,
      ].join("\n"),
    );
  }

  return sections.join(
    "\n\n",
  );
}

function createHtmlMetroSnapshot(
  singleFamily: MarketStats | null,
  condo: MarketStats | null,
): string {
  const cards: string[] = [];

  if (singleFamily) {
    cards.push(
      createMarketSnapshotCard(
        "Single-Family Homes",
        singleFamily,
      ),
    );
  }

  if (condo) {
    cards.push(
      createMarketSnapshotCard(
        "Condominiums",
        condo,
      ),
    );
  }

  return cards.join(
    "\n",
  );
}

function createMarketSnapshotCard(
  title: string,
  market: MarketStats,
): string {
  return `
<div style="
  background: #f7f7f7;
  padding: 18px;
  border-radius: 6px;
  margin-bottom: 16px;
">

  <div style="
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 10px;
  ">
    ${escapeHtml(
      title,
    )}
  </div>

  <div>
    <strong>Inventory:</strong>
    ${escapeHtml(
      formatInventory(
        market.monthsOfInventory,
      ),
    )}
  </div>

  <div>
    <strong>Active listings:</strong>
    ${escapeHtml(
      formatNumber(
        market.activeListings,
      ),
    )}
  </div>

  <div>
    <strong>Pending listings:</strong>
    ${escapeHtml(
      formatNumber(
        market.pendingListings,
      ),
    )}
  </div>

  <div>
    <strong>Pending-to-active ratio:</strong>
    ${escapeHtml(
      formatPercent(
        market.pendingActiveRatio,
      ),
    )}
  </div>

  <div>
    <strong>Average sale price:</strong>
    ${escapeHtml(
      formatCurrency(
        market.averageSalePrice,
      ),
    )}
  </div>

  <div>
    <strong>Average sold DOM:</strong>
    ${escapeHtml(
      formatDays(
        market.averageDaysOnMarketSold,
      ),
    )}
  </div>

</div>`;
}

function createTextRanking(
  markets: MarketRanking[],
): string {
  if (
    markets.length === 0
  ) {
    return "No market data available.";
  }

  return markets
    .map(
      (market) =>
        `${market.rank}. ${cleanAreaName(
          market.area,
        )} — ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}, ` +
        `${formatPercent(
          market.pendingActiveRatio,
        )} pending ratio, ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM`,
    )
    .join("\n");
}

function createHtmlRanking(
  markets: MarketRanking[],
): string {
  if (
    markets.length === 0
  ) {
    return `
<p>
  No market data available.
</p>`;
  }

  return markets
    .map(
      (market) => `
<div style="
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eeeeee;
">

  <div style="
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 7px;
  ">
    ${market.rank}.
    ${escapeHtml(
      cleanAreaName(
        market.area,
      ),
    )}
  </div>

  <div>
    <strong>Inventory:</strong>
    ${escapeHtml(
      formatInventory(
        market.monthsOfInventory,
      ),
    )}
  </div>

  <div>
    <strong>Pending-to-active ratio:</strong>
    ${escapeHtml(
      formatPercent(
        market.pendingActiveRatio,
      ),
    )}
  </div>

  <div>
    <strong>Average sold DOM:</strong>
    ${escapeHtml(
      formatDays(
        market.averageDaysOnMarketSold,
      ),
    )}
  </div>

  <div>
    <strong>Average sale price:</strong>
    ${escapeHtml(
      formatCurrency(
        market.averageSalePrice,
      ),
    )}
  </div>

</div>`,
    )
    .join("");
}

function createTextMarketSummary(
  stats: ExtractedMarketStats,
): string {
  return stats.markets
    .map(
      (market) =>
        [
          cleanAreaName(
            market.area,
          ),
          formatPropertyType(
            market.propertyType,
          ),
          `Active: ${formatNumber(
            market.activeListings,
          )}`,
          `Pending: ${formatNumber(
            market.pendingListings,
          )}`,
          `Inventory: ${formatInventory(
            market.monthsOfInventory,
          )}`,
          `Avg Sale: ${formatCurrency(
            market.averageSalePrice,
          )}`,
          `Sold DOM: ${formatDays(
            market.averageDaysOnMarketSold,
          )}`,
        ].join(" | "),
    )
    .join("\n");
}

function createHtmlMarketRows(
  stats: ExtractedMarketStats,
): string {
  return stats.markets
    .map(
      (market) => `
<tr>
  <td style="${tableCellStyle()}">
    ${escapeHtml(
      cleanAreaName(
        market.area,
      ),
    )}
  </td>

  <td style="${tableCellStyle()}">
    ${escapeHtml(
      formatPropertyType(
        market.propertyType,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatNumber(
        market.activeListings,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatNumber(
        market.pendingListings,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatInventory(
        market.monthsOfInventory,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatCurrency(
        market.averageSalePrice,
      ),
    )}
  </td>

  <td style="${tableCellStyle(
    true,
  )}">
    ${escapeHtml(
      formatDays(
        market.averageDaysOnMarketSold,
      ),
    )}
  </td>
</tr>`,
    )
    .join("");
}

function createCopyBox(
  value: string,
): string {
  return `
<div style="
  white-space: pre-wrap;
  background: #f7f7f7;
  padding: 16px;
  border-radius: 6px;
">${escapeHtml(
    value,
  )}</div>`;
}

function findMetroCondo(
  stats: ExtractedMarketStats,
): MarketStats | null {
  return (
    stats.markets.find(
      (market) =>
        market.area ===
          "Greater Portland Areas" &&
        market.propertyType ===
          "Condominiums",
    ) ?? null
  );
}

function createPublicBlogUrl(
  slug: string,
): string {
  return (
    "https://blog.steventranrealestate.com/posts/" +
    `${slug}/`
  );
}

function cleanAreaName(
  area: string,
): string {
  return area
    .replace(
      /\s+Area$/i,
      "",
    )
    .replace(
      "Greater Portland Areas",
      "Greater Portland",
    );
}

function formatPropertyType(
  propertyType:
    MarketStats["propertyType"],
): string {
  if (
    propertyType ===
    "Single Family Residential"
  ) {
    return "Single Family";
  }

  if (
    propertyType ===
    "Condominiums"
  ) {
    return "Condominiums";
  }

  return propertyType;
}

function formatCurrency(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  );
}

function formatNumber(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
  );
}

function formatPercent(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return `${value}%`;
}

function formatInventory(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return `${value} months`;
}

function formatDays(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return `${value} days`;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#039;",
    );
}

function dividerStyle(): string {
  return [
    "border: 0",
    "border-top: 1px solid #dddddd",
    "margin: 28px 0",
  ].join("; ");
}

function tableHeaderStyle(
  numeric = false,
): string {
  return [
    "padding: 9px 8px",
    "border-bottom: 2px solid #cccccc",
    "text-align: " +
      (
        numeric
          ? "right"
          : "left"
      ),
    "font-weight: 700",
    "white-space: nowrap",
  ].join("; ");
}

function tableCellStyle(
  numeric = false,
): string {
  return [
    "padding: 9px 8px",
    "border-bottom: 1px solid #eeeeee",
    "text-align: " +
      (
        numeric
          ? "right"
          : "left"
      ),
    "vertical-align: top",
  ].join("; ");
}
