import type {
  gmail_v1,
} from "googleapis";

import type {
  MonthlyMarketAnalysis,
  MonthlyMarketTrend,
} from "./analyzeMonthlyMarketStats.js";

import type {
  MonthlyPriceDropAnalysis,
} from "./analyzeMonthlyPriceDrops.js";

import type {
  GeneratedMonthlyBuyerContent,
} from "./generateMonthlyBuyerContent.js";

interface SendMonthlyBuyerReportOptions {
  gmail: gmail_v1.Gmail;

  marketAnalysis:
    MonthlyMarketAnalysis;

  priceDropAnalysis:
    MonthlyPriceDropAnalysis;

  generatedContent:
    GeneratedMonthlyBuyerContent;

  publicBlogUrl: string;
}

export async function sendMonthlyBuyerReport(
  options:
    SendMonthlyBuyerReportOptions,
): Promise<void> {
  const {
    gmail,
    marketAnalysis,
    priceDropAnalysis,
    generatedContent,
    publicBlogUrl,
  } = options;

  const recipients =
    getRecipients();

  const currentMonth =
    getFollowingMonth(
      marketAnalysis.year,
      marketAnalysis.month,
    );

  const subject =
    `${marketAnalysis.monthName} ${marketAnalysis.year} Portland Metro Content Package`;

  const buyerOpportunityMarkets =
    getBuyerOpportunityMarkets(
      marketAnalysis,
    );

  const competitiveMarkets =
    getCompetitiveMarkets(
      marketAnalysis,
    );

  const youtubeDescription =
    generatedContent
      .youtubeShortsDescription
      .replaceAll(
        "{{BLOG_URL}}",
        publicBlogUrl,
      );

  const facebookPost =
    generatedContent
      .facebookPost
      .replaceAll(
        "{{BLOG_URL}}",
        publicBlogUrl,
      );

  const html =
    createHtmlEmail({
      marketAnalysis,
      priceDropAnalysis,
      generatedContent,
      publicBlogUrl,
      buyerOpportunityMarkets,
      competitiveMarkets,
      currentMonthName:
        currentMonth.monthName,
      youtubeDescription,
      facebookPost,
    });

  const text =
    createTextEmail({
      marketAnalysis,
      priceDropAnalysis,
      generatedContent,
      publicBlogUrl,
      buyerOpportunityMarkets,
      competitiveMarkets,
      currentMonthName:
        currentMonth.monthName,
      youtubeDescription,
      facebookPost,
    });

  const boundary =
    `monthly-report-${Date.now()}`;

  const rawMessage = [
    `To: ${recipients.join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join(
    "\r\n",
  );

  const encodedMessage =
    Buffer.from(
      rawMessage,
      "utf8",
    )
      .toString(
        "base64",
      )
      .replace(
        /\+/g,
        "-",
      )
      .replace(
        /\//g,
        "_",
      )
      .replace(
        /=+$/g,
        "",
      );

  await gmail.users.messages.send({
    userId:
      "me",

    requestBody: {
      raw:
        encodedMessage,
    },
  });

  console.log(
    `Monthly content package emailed to ${recipients.join(", ")}.`,
  );
}

interface EmailContentOptions {
  marketAnalysis:
    MonthlyMarketAnalysis;

  priceDropAnalysis:
    MonthlyPriceDropAnalysis;

  generatedContent:
    GeneratedMonthlyBuyerContent;

  publicBlogUrl: string;

  buyerOpportunityMarkets:
    MonthlyMarketTrend[];

  competitiveMarkets:
    MonthlyMarketTrend[];

  currentMonthName: string;

  youtubeDescription: string;

  facebookPost: string;
}

function createHtmlEmail(
  options:
    EmailContentOptions,
): string {
  const {
    marketAnalysis,
    priceDropAnalysis,
    generatedContent,
    publicBlogUrl,
    buyerOpportunityMarkets,
    competitiveMarkets,
    currentMonthName,
    youtubeDescription,
    facebookPost,
  } = options;

  const priceDropSection =
    createPriceDropHtml(
      priceDropAnalysis,
    );

  const buyerRows =
    buyerOpportunityMarkets
      .map(
        (market) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e5e5;">
              <strong>${escapeHtml(
                cleanAreaName(
                  market.area,
                ),
              )}</strong>
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${formatNumber(
                market.endingActiveListings,
              )}
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${formatDays(
                market.endingSoldDom,
              )}
            </td>
          </tr>
        `,
      )
      .join("");

  const competitiveRows =
    competitiveMarkets
      .map(
        (market) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e5e5;">
              <strong>${escapeHtml(
                cleanAreaName(
                  market.area,
                ),
              )}</strong>
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${formatNumber(
                market.endingActiveListings,
              )}
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${formatDays(
                market.endingSoldDom,
              )}
            </td>
          </tr>
        `,
      )
      .join("");

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <div style="max-width:760px;margin:0 auto;padding:24px;">

      <div style="background:#ffffff;border-radius:10px;padding:30px;">

        <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2;">
          ${escapeHtml(
            marketAnalysis.monthName,
          )} ${marketAnalysis.year} Portland Metro Content Package
        </h1>

        <p style="margin:0 0 24px;color:#666;font-size:16px;line-height:1.5;">
          Your monthly market lookback is complete.
          Here's what happened in
          ${escapeHtml(
            marketAnalysis.monthName,
          )}
          and your ready-to-use content for
          ${escapeHtml(
            currentMonthName,
          )}.
        </p>

        <a
          href="${escapeHtml(
            publicBlogUrl,
          )}"
          style="
            display:inline-block;
            background:#111;
            color:#fff;
            text-decoration:none;
            padding:12px 18px;
            border-radius:6px;
            font-weight:bold;
            margin-bottom:28px;
          "
        >
          Read the Published Blog
        </a>

        <h2 style="font-size:21px;margin:10px 0 12px;">
          📊 Quick Market Reference
        </h2>

        <p style="margin:0 0 16px;color:#666;line-height:1.5;">
          ${marketAnalysis.reportsAvailable}
          weekly market snapshot${
            marketAnalysis.reportsAvailable ===
            1
              ? ""
              : "s"
          }
          were used for this report.
        </p>

        <h3 style="font-size:17px;margin:18px 0 10px;">
          Areas Giving Buyers More Breathing Room
        </h3>

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="border-collapse:collapse;margin-bottom:24px;"
        >
          <thead>
            <tr style="background:#f3f3f3;">
              <th style="padding:10px;text-align:left;">
                Area
              </th>

              <th style="padding:10px;text-align:right;">
                Active Listings
              </th>

              <th style="padding:10px;text-align:right;">
                Avg. Days to Sell
              </th>
            </tr>
          </thead>

          <tbody>
            ${buyerRows}
          </tbody>
        </table>

        <h3 style="font-size:17px;margin:18px 0 10px;">
          Faster-Moving Areas
        </h3>

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="border-collapse:collapse;margin-bottom:28px;"
        >
          <thead>
            <tr style="background:#f3f3f3;">
              <th style="padding:10px;text-align:left;">
                Area
              </th>

              <th style="padding:10px;text-align:right;">
                Active Listings
              </th>

              <th style="padding:10px;text-align:right;">
                Avg. Days to Sell
              </th>
            </tr>
          </thead>

          <tbody>
            ${competitiveRows}
          </tbody>
        </table>

        ${priceDropSection}

        ${createDivider()}

        ${createCopySection(
          "🎥 90-Second Reel / Shorts Script",
          generatedContent.reelScript,
        )}

        ${createDivider()}

        ${createCopySection(
          "📱 Instagram / Facebook Reel Caption",
          generatedContent.reelCaption,
        )}

        ${createDivider()}

        ${createCopySection(
          "▶️ YouTube Shorts Title",
          generatedContent.youtubeShortsTitle,
        )}

        ${createDivider()}

        ${createCopySection(
          "📝 YouTube Shorts Description",
          youtubeDescription,
        )}

        ${createDivider()}

        ${createCopySection(
          "🔎 YouTube Keywords",
          generatedContent.youtubeKeywords,
        )}

        ${createDivider()}

        ${createCopySection(
          "📲 Instagram Story",
          generatedContent.instagramStory,
        )}

        ${createDivider()}

        ${createCopySection(
          "📘 Facebook Post",
          facebookPost,
        )}

        ${createDivider()}

        <h2 style="font-size:21px;margin:0 0 12px;">
          🔗 Published Blog
        </h2>

        <div
          style="
            background:#f5f5f5;
            border-radius:8px;
            padding:18px;
            font-size:15px;
            line-height:1.55;
            word-break:break-word;
          "
        >
          <a
            href="${escapeHtml(
              publicBlogUrl,
            )}"
            style="color:#111;"
          >
            ${escapeHtml(
              publicBlogUrl,
            )}
          </a>
        </div>

        <p style="margin:28px 0 0;color:#777;font-size:13px;line-height:1.5;">
          Based on the available TMO Reports and historical price-drop
          data for ${escapeHtml(
            marketAnalysis.monthName,
          )} ${marketAnalysis.year}.
          Market conditions vary by neighborhood, property type and
          price range.
        </p>

      </div>
    </div>
  </body>
</html>
`;
}

function createCopySection(
  title: string,
  content: string,
): string {
  return `
    <h2 style="font-size:21px;margin:0 0 12px;">
      ${escapeHtml(
        title,
      )}
    </h2>

    <div
      style="
        background:#f5f5f5;
        border-radius:8px;
        padding:18px;
        white-space:pre-wrap;
        font-size:15px;
        line-height:1.6;
      "
    >${escapeHtml(
      content,
    )}</div>
  `;
}

function createDivider(): string {
  return `
    <hr
      style="
        border:0;
        border-top:1px solid #ddd;
        margin:30px 0;
      "
    />
  `;
}

function createPriceDropHtml(
  analysis:
    MonthlyPriceDropAnalysis,
): string {
  if (
    analysis.snapshotCount ===
      0 ||
    analysis.uniqueListings ===
      0
  ) {
    return `
      <h3 style="font-size:17px;margin:18px 0 10px;">
        Price Drops
      </h3>

      <p style="margin:0 0 28px;color:#666;">
        No historical price-drop data was available for this month.
      </p>
    `;
  }

  const areaRows =
    analysis.areasWithMostPriceDrops
      .filter(
        (area) =>
          area.area &&
          !/^unknown/i.test(
            area.area,
          ),
      )
      .slice(
        0,
        5,
      )
      .map(
        (area) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e5e5;">
              ${escapeHtml(
                cleanAreaName(
                  area.area,
                ),
              )}
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${area.uniqueListings.toLocaleString(
                "en-US",
              )}
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e5e5;text-align:right;">
              ${formatCurrency(
                area.medianReduction,
              )}
            </td>
          </tr>
        `,
      )
      .join("");

  return `
    <h3 style="font-size:17px;margin:18px 0 10px;">
      Price Drops
    </h3>

    <div style="margin-bottom:18px;line-height:1.65;">
      <strong>Unique listings tracked:</strong>
      ${analysis.uniqueListings.toLocaleString(
        "en-US",
      )}
      <br />

      <strong>Typical reduction:</strong>
      ${formatCurrency(
        analysis.medianReduction,
      )}
      <br />

      <strong>Average reduction:</strong>
      ${formatCurrency(
        analysis.averageReduction,
      )}
      <br />

      <strong>Largest reduction tracked:</strong>
      ${formatCurrency(
        analysis.largestReduction,
      )}
    </div>

    ${
      areaRows
        ? `
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="border-collapse:collapse;margin-bottom:28px;"
          >
            <thead>
              <tr style="background:#f3f3f3;">
                <th style="padding:10px;text-align:left;">
                  Area
                </th>

                <th style="padding:10px;text-align:right;">
                  Listings
                </th>

                <th style="padding:10px;text-align:right;">
                  Typical Reduction
                </th>
              </tr>
            </thead>

            <tbody>
              ${areaRows}
            </tbody>
          </table>
        `
        : ""
    }
  `;
}

function createTextEmail(
  options:
    EmailContentOptions,
): string {
  const {
    marketAnalysis,
    priceDropAnalysis,
    generatedContent,
    publicBlogUrl,
    buyerOpportunityMarkets,
    competitiveMarkets,
    currentMonthName,
    youtubeDescription,
    facebookPost,
  } = options;

  const lines: string[] = [];

  lines.push(
    `${marketAnalysis.monthName} ${marketAnalysis.year} Portland Metro Content Package`,
  );

  lines.push("");

  lines.push(
    `Your ${marketAnalysis.monthName} market lookback is complete. Below is your ready-to-use content for ${currentMonthName}.`,
  );

  lines.push("");
  lines.push(
    `Published blog: ${publicBlogUrl}`,
  );

  lines.push("");
  lines.push(
    "QUICK MARKET REFERENCE",
  );

  lines.push(
    `Weekly market snapshots used: ${marketAnalysis.reportsAvailable}`,
  );

  lines.push("");
  lines.push(
    "Areas giving buyers more breathing room:",
  );

  for (
    const market
    of buyerOpportunityMarkets
  ) {
    lines.push(
      `${cleanAreaName(
        market.area,
      )}: ` +
        `${formatNumber(
          market.endingActiveListings,
        )} active listings, ` +
        `${formatDays(
          market.endingSoldDom,
        )}`,
    );
  }

  lines.push("");
  lines.push(
    "Faster-moving areas:",
  );

  for (
    const market
    of competitiveMarkets
  ) {
    lines.push(
      `${cleanAreaName(
        market.area,
      )}: ` +
        `${formatNumber(
          market.endingActiveListings,
        )} active listings, ` +
        `${formatDays(
          market.endingSoldDom,
        )}`,
    );
  }

  lines.push("");
  lines.push(
    "PRICE DROPS",
  );

  if (
    priceDropAnalysis.snapshotCount ===
      0 ||
    priceDropAnalysis.uniqueListings ===
      0
  ) {
    lines.push(
      "No historical price-drop data was available for this month.",
    );
  } else {
    lines.push(
      `Unique listings tracked: ${priceDropAnalysis.uniqueListings}`,
    );

    lines.push(
      `Typical reduction: ${formatCurrency(
        priceDropAnalysis.medianReduction,
      )}`,
    );

    lines.push(
      `Average reduction: ${formatCurrency(
        priceDropAnalysis.averageReduction,
      )}`,
    );

    lines.push(
      `Largest reduction: ${formatCurrency(
        priceDropAnalysis.largestReduction,
      )}`,
    );
  }

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "90-SECOND REEL / SHORTS SCRIPT",
  );

  lines.push("");
  lines.push(
    generatedContent.reelScript,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "INSTAGRAM / FACEBOOK REEL CAPTION",
  );

  lines.push("");
  lines.push(
    generatedContent.reelCaption,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "YOUTUBE SHORTS TITLE",
  );

  lines.push("");
  lines.push(
    generatedContent.youtubeShortsTitle,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "YOUTUBE SHORTS DESCRIPTION",
  );

  lines.push("");
  lines.push(
    youtubeDescription,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "YOUTUBE KEYWORDS",
  );

  lines.push("");
  lines.push(
    generatedContent.youtubeKeywords,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "INSTAGRAM STORY",
  );

  lines.push("");
  lines.push(
    generatedContent.instagramStory,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "FACEBOOK POST",
  );

  lines.push("");
  lines.push(
    facebookPost,
  );

  lines.push("");
  lines.push(
    "================================",
  );

  lines.push("");
  lines.push(
    "PUBLISHED BLOG",
  );

  lines.push("");
  lines.push(
    publicBlogUrl,
  );

  return lines.join(
    "\n",
  );
}

function getBuyerOpportunityMarkets(
  analysis:
    MonthlyMarketAnalysis,
): MonthlyMarketTrend[] {
  return [
    ...analysis.highestEndingSingleFamilyInventory,
  ]
    .filter(
      isValidMarket,
    )
    .filter(
      uniqueAreaFilter,
    )
    .slice(
      0,
      4,
    );
}

function getCompetitiveMarkets(
  analysis:
    MonthlyMarketAnalysis,
): MonthlyMarketTrend[] {
  return [
    ...analysis.lowestEndingSingleFamilyInventory,
  ]
    .filter(
      isValidMarket,
    )
    .filter(
      uniqueAreaFilter,
    )
    .slice(
      0,
      4,
    );
}

function isValidMarket(
  market:
    MonthlyMarketTrend,
): boolean {
  if (
    !market.area ||
    /^unknown/i.test(
      market.area,
    ) ||
    /Greater Portland/i.test(
      market.area,
    )
  ) {
    return false;
  }

  return true;
}

function uniqueAreaFilter(
  market:
    MonthlyMarketTrend,

  index:
    number,

  markets:
    MonthlyMarketTrend[],
): boolean {
  const key =
    normalizeArea(
      market.area,
    );

  return (
    markets.findIndex(
      (candidate) =>
        normalizeArea(
          candidate.area,
        ) ===
        key,
    ) ===
    index
  );
}

function normalizeArea(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /^com\s+/,
      "",
    )
    .replace(
      /\s+area$/,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function cleanAreaName(
  value: string,
): string {
  return value
    .replace(
      /^com\s+/i,
      "",
    )
    .replace(
      /\s+Area$/i,
      "",
    )
    .trim();
}

function getRecipients(): string[] {
  const configuredRecipient =
    process.env.REPORT_RECIPIENT?.trim();

  if (
    configuredRecipient
  ) {
    return [
      configuredRecipient,
    ];
  }

  return [
    "steven@diverserg.com",
  ];
}

function getFollowingMonth(
  year: number,
  month: number,
): {
  year: number;
  monthName: string;
} {
  const date =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    );

  return {
    year:
      date.getUTCFullYear(),

    monthName:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",

          timeZone:
            "UTC",
        },
      ).format(
        date,
      ),
  };
}

function formatCurrency(
  value:
    number |
    null,
): string {
  if (
    value ===
    null
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        0,
    },
  );
}

function formatNumber(
  value:
    number |
    null,
): string {
  if (
    value ===
    null
  ) {
    return "N/A";
  }

  return Math.round(
    value,
  ).toLocaleString(
    "en-US",
  );
}

function formatDays(
  value:
    number |
    null,
): string {
  if (
    value ===
    null
  ) {
    return "N/A";
  }

  return `about ${Math.round(
    value,
  )} days to sell`;
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