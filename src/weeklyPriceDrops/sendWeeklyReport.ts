import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { gmail_v1 } from "googleapis";
import type { WeeklyAnalysis } from "../analysis/types.js";

const RECIPIENT =
  process.env.REPORT_RECIPIENT?.trim() ||
  "steven@diverserg.com";

export async function sendWeeklyReport(
  gmail: gmail_v1.Gmail,
  analysis: WeeklyAnalysis,
  reportUrl: string,
  instagramImagePaths: string[] = [],
  portlandHomeGuideCaption: string | null = null,
): Promise<string> {
  const subject = createSubject();

  const textBody = createTextEmailBody(
    analysis,
    reportUrl,
    instagramImagePaths.length,
    portlandHomeGuideCaption,
  );

  const htmlBody = createHtmlEmailBody(
    analysis,
    reportUrl,
    instagramImagePaths.length,
    portlandHomeGuideCaption,
  );

  const mixedBoundary =
    `weekly-price-drop-mixed-${Date.now()}`;

  const alternativeBoundary =
    `weekly-price-drop-alt-${Date.now()}`;

  const attachmentParts =
    await buildJpegAttachmentParts(
      instagramImagePaths,
      mixedBoundary,
    );

  const mimeMessage = [
    `To: ${RECIPIENT}`,
    `From: ${RECIPIENT}`,
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

  const raw = Buffer.from(mimeMessage)
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

  if (!response.data.id) {
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

function createSubject(): string {
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

  return `Weekly Price Drop Report - ${date}`;
}

function createTextEmailBody(
  analysis: WeeklyAnalysis,
  reportUrl: string,
  instagramImageCount: number,
  portlandHomeGuideCaption: string | null,
): string {
  const listings =
    [...analysis.selectedListings]
      .sort(
        (a, b) =>
          a.rank - b.rank,
      )
      .map(
        (listing) => [
          `${listing.rank}. ${listing.address}`,
          `Zillow: ${createZillowUrl(
            listing.address,
          )}`,
          `Current price: ${formatCurrency(
            listing.currentPrice,
          )}`,
          `Original price: ${formatNullableCurrency(
            listing.originalPrice,
          )}`,
          `Total reduction: ${formatReduction(
            listing.totalPriceReduction,
          )}`,
          `Why it made the cut: ${listing.shortReason}`,
          `Concern: ${listing.concern}`,
          "",
        ].join("\n"),
      )
      .join("\n");

  const factChecks =
    analysis.factCheckNotes
      .map(
        (note) => `- ${note}`,
      )
      .join("\n");

  const commaSeparatedMls =
    [...analysis.selectedListings]
      .sort(
        (a, b) =>
          a.rank - b.rank,
      )
      .map(
        (listing) =>
          listing.mlsNumber,
      )
      .join(", ");

  const blogUrl =
    createPriceDropBlogUrl();

  const storyBlurb =
    createPriceDropStoryBlurb(
      analysis,
    );

  return [
    "PORTLAND METRO PRICE ALERT",
    "",
    analysis.summary,
    "",
    "PUBLISHED BLOG",
    "==============",
    "",
    blogUrl,
    "",
    "RMLS LISTING REPORT",
    "===================",
    "",
    "Open the report for photos, listing details and exact price changes:",
    reportUrl,
    "",
    "TOP PICKS",
    "=========",
    "",
    listings,
    "",
    "MLS NUMBERS (Copy & Paste into RMLS)",
    "====================================",
    "",
    commaSeparatedMls,
    "",
    ...(instagramImageCount > 0
      ? [
          "PORTLAND HOME GUIDE PRICE-DROP CAROUSEL",
          "======================================",
          "",
          `${instagramImageCount} Instagram-ready JPEGs are attached to this email.`,
          "Files are ordered from the cover slide through the final CTA slide.",
          "",
          "PORTLAND HOME GUIDE CAROUSEL CAPTION",
          "===================================",
          "",
          portlandHomeGuideCaption ||
            "Caption unavailable.",
          "",
        ]
      : []),
    "GOOGLE BUSINESS PROFILE POST",
    "============================",
    "",
    `${analysis.googleBusinessPost.length}/1500 characters`,
    "",
    analysis.googleBusinessPost,
    "",
    "INSTAGRAM STORY BLURB",
    "=====================",
    "",
    storyBlurb,
    "",
    "REEL SCRIPT",
    "===========",
    "",
    analysis.reelScript,
    "",
    "INSTAGRAM CAPTION",
    "=================",
    "",
    analysis.instagramCaption,
    "",
    "YOUTUBE SHORTS TITLE",
    "====================",
    "",
    analysis.youtubeShortsTitle,
    "",
    "YOUTUBE SHORTS DESCRIPTION",
    "==========================",
    "",
    analysis.youtubeShortsDescription,
    "",
    "YOUTUBE KEYWORDS",
    "================",
    "",
    analysis.youtubeKeywords,
    "",
    "FINAL FACT CHECK",
    "================",
    "",
    factChecks ||
      "- Confirm the exact reduction for each selected listing.",
    "",
    "Generated automatically from the RMLS PRICE DROP report.",
  ].join("\n");
}

function createHtmlEmailBody(
  analysis: WeeklyAnalysis,
  reportUrl: string,
  instagramImageCount: number,
  portlandHomeGuideCaption: string | null,
): string {
  const listings =
    [...analysis.selectedListings]
      .sort(
        (a, b) =>
          a.rank - b.rank,
      )
      .map((listing) => {
        const zillowUrl =
          createZillowUrl(
            listing.address,
          );

        return `
<div style="margin-bottom: 26px;">
  <div style="
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 6px;
  ">
    ${listing.rank}.
    <a
      href="${escapeHtml(zillowUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      style="
        color: #1155cc;
        text-decoration: underline;
      "
    >${escapeHtml(
      listing.address,
    )}</a>
  </div>

  <div>
    <strong>Current price:</strong>
    ${escapeHtml(
      formatCurrency(
        listing.currentPrice,
      ),
    )}
  </div>

  <div>
    <strong>Original price:</strong>
    ${escapeHtml(
      formatNullableCurrency(
        listing.originalPrice,
      ),
    )}
  </div>

  <div>
    <strong>Total reduction:</strong>
    ${escapeHtml(
      formatReduction(
        listing.totalPriceReduction,
      ),
    )}
  </div>

  <div style="margin-top: 6px;">
    <strong>Why it made the cut:</strong>
    ${escapeHtml(
      listing.shortReason,
    )}
  </div>

  <div>
    <strong>Concern:</strong>
    ${escapeHtml(
      listing.concern,
    )}
  </div>
</div>`;
      })
      .join("");

  const commaSeparatedMls =
    [...analysis.selectedListings]
      .sort(
        (a, b) =>
          a.rank - b.rank,
      )
      .map(
        (listing) =>
          listing.mlsNumber,
      )
      .join(", ");

  const factChecks =
    analysis.factCheckNotes
      .map(
        (note) =>
          `<li>${escapeHtml(
            note,
          )}</li>`,
      )
      .join("");

  const blogUrl =
    createPriceDropBlogUrl();

  const storyBlurb =
    createPriceDropStoryBlurb(
      analysis,
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
    Portland Metro Price Alert
  </h1>

  <p style="margin-top: 0;">
    ${escapeHtml(
      analysis.summary,
    )}
  </p>

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Published Blog</h2>

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
      Open this week's Portland Metro Price Drops article
    </a>
  </p>

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>RMLS Listing Report</h2>

  <p>
    <a
      href="${escapeHtml(
        reportUrl,
      )}"
      target="_blank"
      rel="noopener noreferrer"
      style="
        color: #1155cc;
        text-decoration: underline;
      "
    >
      Open the full RMLS report
    </a>
    for photos, listing details and exact price changes.
  </p>

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Top Picks</h2>

  ${listings}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>
    MLS Numbers
    <span style="
      font-size: 14px;
      font-weight: normal;
    ">
      (Copy & Paste into RMLS)
    </span>
  </h2>

  <p style="
    font-family: monospace;
    font-size: 15px;
  ">
    ${escapeHtml(
      commaSeparatedMls,
    )}
  </p>

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  ${
    instagramImageCount > 0
      ? `
  <h2>Portland Home Guide Price-Drop Carousel</h2>

  <p>
    <strong>${instagramImageCount} Instagram-ready JPEGs are attached.</strong>
    They are ordered from the cover slide through the final CTA slide.
  </p>

  <h3>Portland Home Guide Carousel Caption</h3>

  ${createCopyBox(
    portlandHomeGuideCaption ||
      "Caption unavailable.",
  )}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">
`
      : ""
  }

  <h2>Google Business Profile Post</h2>

  <p style="
    color: #666666;
    margin-top: -6px;
  ">
    ${analysis.googleBusinessPost.length}/1500 characters.
    Copy and paste this directly into your Google Business Profile post.
  </p>

  ${createCopyBox(
    analysis.googleBusinessPost,
  )}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Instagram Story Blurb</h2>

  ${createCopyBox(
    storyBlurb,
  )}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Reel Script</h2>

  ${createCopyBox(
    analysis.reelScript,
  )}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Instagram Caption</h2>

  ${createCopyBox(
    analysis.instagramCaption,
  )}

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>YouTube Shorts Title</h2>

  <p>
    ${escapeHtml(
      analysis.youtubeShortsTitle,
    )}
  </p>

  <h2>YouTube Shorts Description</h2>

  ${createCopyBox(
    analysis.youtubeShortsDescription,
  )}

  <h2>YouTube Keywords</h2>

  <p>
    ${escapeHtml(
      analysis.youtubeKeywords,
    )}
  </p>

  ${
    factChecks
      ? `
  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Final Fact Check</h2>

  <ul>
    ${factChecks}
  </ul>
`
      : ""
  }

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <p style="
    font-size: 12px;
    color: #777777;
  ">
    Generated automatically from the RMLS PRICE DROP report.
  </p>

</body>
</html>
`;
}

function createPriceDropStoryBlurb(
  analysis: WeeklyAnalysis,
): string {
  const listings =
    [...analysis.selectedListings]
      .sort(
        (a, b) =>
          a.rank - b.rank,
      );

  const validReductions =
    listings
      .map(
        (listing) =>
          listing.totalPriceReduction,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          value > 0,
      );

  const largestReduction =
    validReductions.length > 0
      ? Math.max(
          ...validReductions,
        )
      : null;

  const reductionLine =
    largestReduction !== null
      ? `This week's featured homes include price reductions of up to about ${formatRoundedCurrency(
          largestReduction,
        )}.`
      : "I pulled out a few Portland Metro listings worth taking a closer look at this week.";

  return [
    "New Portland Metro Price Drop update is live 🏡",
    "",
    reductionLine,
    "",
    "I picked out the homes that stood out most based on price changes, features and overall value.",
    "",
    "See the full breakdown at steventranrealestate.com.",
  ].join("\n");
}

function createPriceDropBlogUrl(): string {
  const displayDate =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Los_Angeles",
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    ).format(new Date());

  const slugDate =
    displayDate
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\s+/g, "-");

  return (
    "https://blog.steventranrealestate.com/posts/" +
    `portland-metro-price-drops-${slugDate}/`
  );
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

function createZillowUrl(
  address: string,
): string {
  const slug = address
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "-");

  return (
    "https://www.zillow.com/homes/" +
    `${encodeURIComponent(
      slug,
    )}_rb/`
  );
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(
  value: number,
): string {
  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  );
}

function formatRoundedCurrency(
  value: number,
): string {
  const rounded =
    Math.round(
      value / 1000,
    ) * 1000;

  return formatCurrency(
    rounded,
  );
}

function formatNullableCurrency(
  value: number | null,
): string {
  if (value === null) {
    return "Verify in RMLS";
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

function formatReduction(
  value: number | null,
): string {
  if (
    value === null ||
    value <= 0
  ) {
    return "Verify price history in RMLS";
  }

  const rounded =
    Math.round(
      value / 5000,
    ) * 5000;

  return (
    `About ` +
    rounded.toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      },
    ) +
    ` below the original list price`
  );
}
