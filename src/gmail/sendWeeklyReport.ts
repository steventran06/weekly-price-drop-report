import type { gmail_v1 } from "googleapis";
import type { WeeklyAnalysis } from "../analysis/types.js";

const RECIPIENT =
  process.env.REPORT_RECIPIENT?.trim() ||
  "steven@diverserg.com";

export async function sendWeeklyReport(
  gmail: gmail_v1.Gmail,
  analysis: WeeklyAnalysis,
  reportUrl: string,
): Promise<string> {
  const subject = createSubject();

  const textBody = createTextEmailBody(
    analysis,
    reportUrl,
  );

  const htmlBody = createHtmlEmailBody(
    analysis,
    reportUrl,
  );

  const boundary =
    `weekly-price-drop-${Date.now()}`;

  const mimeMessage = [
    `To: ${RECIPIENT}`,
    `From: ${RECIPIENT}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    textBody,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
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

  return [
    "PORTLAND METRO PRICE ALERT",
    "",
    analysis.summary,
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

  <h2>Reel Script</h2>

  <div style="
    white-space: pre-wrap;
    background: #f7f7f7;
    padding: 16px;
    border-radius: 6px;
  ">${escapeHtml(
    analysis.reelScript,
  )}</div>

  <hr style="
    border: 0;
    border-top: 1px solid #dddddd;
    margin: 28px 0;
  ">

  <h2>Instagram Caption</h2>

  <div style="
    white-space: pre-wrap;
    background: #f7f7f7;
    padding: 16px;
    border-radius: 6px;
  ">${escapeHtml(
    analysis.instagramCaption,
  )}</div>

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

  <div style="
    white-space: pre-wrap;
    background: #f7f7f7;
    padding: 16px;
    border-radius: 6px;
  ">${escapeHtml(
    analysis.youtubeShortsDescription,
  )}</div>

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