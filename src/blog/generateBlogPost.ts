import type { RmlsListing } from "../rmls/parseListings.js";
import { parseOpenAIJson } from "../analysis/json.js";
import {
  createOpenAIClient,
  getOpenAIModel,
} from "../analysis/openaiClient.js";
import type {
  SelectedListing,
  WeeklyAnalysis,
} from "../analysis/types.js";

interface BlogPropertyCopy {
  overview: string;
  whyItStandsOut: string;
}

interface GeneratedBlogCopy {
  introduction: string;
  propertyCopy: Record<string, BlogPropertyCopy>;
  buyerEducation: string;
  description: string;
}

export interface GeneratedBlogPost {
  filename: string;
  slug: string;
  title: string;
  markdown: string;
}

interface MatchedListing {
  selection: SelectedListing;
  source: RmlsListing;
}

const COVER_IMAGE =
  "/assets/weekly-price-drops-cover.png";

const BASE_TAGS = [
  "portland-real-estate",
  "portland-metro",
  "portland-price-drops",
  "price-drops",
  "homes-for-sale",
];

export async function generateBlogPost(
  analysis: WeeklyAnalysis,
  sourceListings: RmlsListing[],
): Promise<GeneratedBlogPost> {
  const selectedSources = matchSelectedListings(
    analysis.selectedListings,
    sourceListings,
  );

  const client = createOpenAIClient();
  const model = getOpenAIModel();

  console.log(
    `Generating blog post from ${selectedSources.length} selected listing(s)...`,
  );

  const copyInput = selectedSources.map(
    ({ selection, source }) => ({
      mlsNumber: selection.mlsNumber,

      currentPrice: source.currentPrice,
      originalPrice: source.originalPrice,
      totalPriceReduction:
        source.totalPriceReduction,

      bedrooms: source.bedrooms,
      fullBathrooms:
        source.fullBathrooms,
      partialBathrooms:
        source.partialBathrooms,
      squareFeet: source.squareFeet,
      yearBuilt: source.yearBuilt,
      acres: source.acres,

      propertyType:
        source.propertyType,
      style: source.style,
      neighborhood:
        source.neighborhood,

      publicRemarks:
        source.remarks,

      selectionReason:
        selection.shortReason,
    }),
  );

  const response =
    await client.responses.create({
      model,
      store: false,

      instructions: `
You are writing supporting copy for Steven Tran's weekly Portland
Metro Price Alert blog series.

Steven is a Portland-area real estate broker. His writing should be
useful, direct, knowledgeable and conversational.

It should not sound like:
- generic AI copy
- an advertisement
- a pasted MLS description
- exaggerated real estate marketing

The application itself will insert:
- addresses
- prices
- price reductions
- bedrooms
- bathrooms
- square footage
- year built
- property images
- Zillow links
- headings
- Markdown formatting
- disclaimers

Write only:
- A useful two-to-three paragraph introduction
- One concise overview for each selected property
- One short explanation of why each property stood out
- A short educational section explaining how buyers should evaluate
  price reductions
- A concise SEO description

Rules:
- Use only facts supplied in the input.
- Read and use the public remarks.
- Paraphrase public remarks rather than copying them.
- Favor specific property details over generic adjectives.
- Do not claim that a property is definitively underpriced.
- Do not claim that the reduction represents the most recent individual
  price change.
- totalPriceReduction represents the difference between the original
  RMLS list price and the current list price.
- Do not mention MLS numbers in the prose.
- Do not write street addresses in the prose.
- Do not add Markdown headings.
- Do not add property lists.
- Do not add contact information.
- Do not add a relocation CTA.
- Do not use long dashes.
- Do not use phrases such as:
  "dream home"
  "won't last"
  "incredible deal"
  "no fluff"
  "perfect"
- Do not invent schools, commute times, amenities, neighborhood claims,
  financing terms or property features.
- Return valid JSON only.
`,

      input: `
Create blog copy for these selected listings:

${JSON.stringify(copyInput, null, 2)}

Return JSON matching this exact structure:

{
  "introduction": "string",
  "propertyCopy": {
    "MLS_NUMBER": {
      "overview": "string",
      "whyItStandsOut": "string"
    }
  },
  "buyerEducation": "string",
  "description": "string"
}

Requirements:
- propertyCopy must contain exactly one entry for each supplied MLS number.
- Each overview should be approximately 45 to 80 words.
- Each whyItStandsOut paragraph should be approximately 25 to 50 words.
- The introduction should explain that this is a dated weekly review of
  selected Portland Metro homes with notable price reductions.
- The introduction should make clear that these are selected properties,
  not necessarily the five largest reductions in the entire market.
- buyerEducation should explain that buyers should still consider comparable
  sales, property condition, inspections, financing terms and local demand.
- description should be approximately 140 to 160 characters when possible.
- Do not include fields outside this structure.
`,
    });

  const generatedCopy =
    parseOpenAIJson<GeneratedBlogCopy>(
      response.output_text,
      "blog",
    );

  validateBlogCopy(
    generatedCopy,
    analysis.selectedListings,
  );

  return assembleBlogPost(
    selectedSources,
    generatedCopy,
  );
}

function assembleBlogPost(
  selectedSources: MatchedListing[],
  copy: GeneratedBlogCopy,
): GeneratedBlogPost {
  const publicationDate =
    getPacificDateParts();

  const title =
    `Portland Metro Price Drops This Week: ` +
    publicationDate.displayDate;

  const slug =
    `portland-metro-price-drops-` +
    publicationDate.slugDate;

  const filename =
    `${publicationDate.isoDate}-weekly-price-drops.md`;

  const tags =
    createBlogTags(selectedSources);

  const tagsYaml = tags
    .map((tag) => `  - ${tag}`)
    .join("\n");

  const comparisonRows = selectedSources
    .map(({ selection, source }) => {
      const zillowUrl =
        createZillowUrl(
          selection.address,
        );

      const linkedAddress =
        `[${escapeTableCell(
          selection.address,
        )}](${zillowUrl})`;

      return (
        `| ${linkedAddress} ` +
        `| ${formatCurrencyCell(
          source.currentPrice,
        )} ` +
        `| ${formatCurrencyCell(
          source.originalPrice,
        )} ` +
        `| ${formatReductionCell(
          source.totalPriceReduction,
        )} |`
      );
    })
    .join("\n");

  const propertySections = selectedSources
    .map(
      ({ selection, source }, index) => {
        const propertyCopy =
          copy.propertyCopy[
            selection.mlsNumber
          ];

        const heading =
          createPropertyHeading(
            selection,
            source,
          );

        const zillowUrl =
          createZillowUrl(
            selection.address,
          );

        const propertyImage =
          source.imageUrl
            ? `![${escapeMarkdownAlt(
                heading,
              )}](${source.imageUrl})`
            : "";

        const imageSection =
          propertyImage
            ? `${propertyImage}\n\n`
            : "";

        return `## ${index + 1}. ${heading}

${imageSection}**Address:** [${selection.address}](${zillowUrl})  
**Current price:** ${formatNullableCurrency(
          source.currentPrice,
        )}  
**Original list price:** ${formatNullableCurrency(
          source.originalPrice,
        )}  
**Reduction from original price:** ${formatReductionText(
          source.totalPriceReduction,
        )}  
**Bedrooms:** ${formatNullableNumber(
          source.bedrooms,
        )}  
**Bathrooms:** ${formatBathrooms(
          source.fullBathrooms,
          source.partialBathrooms,
        )}  
**Square feet:** ${formatSquareFeet(
          source.squareFeet,
        )}  
**Year built:** ${formatNullableNumber(
          source.yearBuilt,
        )}

${propertyCopy.overview}

### Why I Picked This Home

${propertyCopy.whyItStandsOut}

* * *`;
      },
    )
    .join("\n\n");

  const markdown = `---
author: Steven Tran
pubDatetime: ${publicationDate.isoDate}
modDatetime: ${publicationDate.isoDate}
title: "${escapeYamlString(title)}"
slug: ${slug}
featured: false
draft: false
tags:
${tagsYaml}
description: "${escapeYamlString(
    copy.description,
  )}"
---

![](${COVER_IMAGE})

${copy.introduction}

The listings and prices in this article were reviewed on **${publicationDate.displayDate}**.

These homes were selected because they combine meaningful price changes with location, property features, condition, or overall buyer appeal compared with other homes in this week's report.

Availability, pricing, incentives and property details can change at any time.

* * *

## 🏡 This Week’s Portland Metro Price Drops

| Address | Current Price | Original Price | Reduction From Original Price |
|---|---:|---:|---:|
${comparisonRows}

* * *

${propertySections}

## What Buyers Should Know About Price Reductions

${copy.buyerEducation}

A price reduction can indicate seller motivation, but it can also mean that the original asking price was higher than the market supported.

The reduction itself is only one piece of the puzzle. Buyers should still review comparable sales, property condition, disclosures, inspection findings, financing terms and neighborhood demand before deciding how much value a price change actually creates.

* * *

## Interested in One of These Homes?

If one of these properties caught your attention, I can send you the current listing details, photos, disclosures, showing availability and recent comparable sales.

Listing information is subject to change. Properties featured in this article may be listed by brokers other than Steven Tran and Diverse Realty Group.
`;

  return {
    filename,
    slug,
    title,
    markdown,
  };
}

function matchSelectedListings(
  selections: SelectedListing[],
  sources: RmlsListing[],
): MatchedListing[] {
  const sourcesByMls = new Map(
    sources.map((source) => [
      source.mlsNumber,
      source,
    ]),
  );

  return [...selections]
    .sort(
      (a, b) =>
        a.rank - b.rank,
    )
    .map((selection) => {
      const source =
        sourcesByMls.get(
          selection.mlsNumber,
        );

      if (!source) {
        throw new Error(
          `Blog generator could not find MLS ${selection.mlsNumber}.`,
        );
      }

      return {
        selection,
        source,
      };
    });
}

function validateBlogCopy(
  copy: GeneratedBlogCopy,
  selections: SelectedListing[],
): void {
  if (
    !copy ||
    typeof copy.introduction !==
      "string" ||
    typeof copy.buyerEducation !==
      "string" ||
    typeof copy.description !==
      "string" ||
    !copy.propertyCopy ||
    typeof copy.propertyCopy !==
      "object"
  ) {
    throw new Error(
      "Generated blog response is missing required fields.",
    );
  }

  const expectedMlsNumbers =
    new Set(
      selections.map(
        (selection) =>
          selection.mlsNumber,
      ),
    );

  const returnedMlsNumbers =
    Object.keys(
      copy.propertyCopy,
    );

  if (
    returnedMlsNumbers.length !==
    expectedMlsNumbers.size
  ) {
    throw new Error(
      "Generated blog property count does not match the selected listings.",
    );
  }

  for (
    const mlsNumber
    of expectedMlsNumbers
  ) {
    const propertyCopy =
      copy.propertyCopy[
        mlsNumber
      ];

    if (
      !propertyCopy ||
      typeof propertyCopy.overview !==
        "string" ||
      typeof propertyCopy.whyItStandsOut !==
        "string"
    ) {
      throw new Error(
        `Generated blog copy is missing MLS ${mlsNumber}.`,
      );
    }
  }

  for (
    const mlsNumber
    of returnedMlsNumbers
  ) {
    if (
      !expectedMlsNumbers.has(
        mlsNumber,
      )
    ) {
      throw new Error(
        `Generated blog included unknown MLS ${mlsNumber}.`,
      );
    }
  }
}

function createBlogTags(
  listings: MatchedListing[],
): string[] {
  const tags = new Set<string>(
    BASE_TAGS,
  );

  for (const {
    selection,
    source,
  } of listings) {
    const city =
      extractCity(
        selection.address,
      );

    if (city) {
      tags.add(
        normalizeTag(city),
      );
    }

    const neighborhood =
      source.neighborhood?.trim();

    if (neighborhood) {
      tags.add(
        normalizeTag(
          neighborhood,
        ),
      );
    }
  }

  return [...tags];
}

function normalizeTag(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createPropertyHeading(
  selection: SelectedListing,
  source: RmlsListing,
): string {
  const neighborhood =
    source.neighborhood?.trim();

  const city =
    extractCity(
      selection.address,
    );

  const location =
    neighborhood ||
    city ||
    "Portland Metro";

  const style =
    source.style
      ?.split(",")[0]
      ?.trim();

  const reason =
    selection.shortReason
      ?.toLowerCase() ?? "";

  if (
    reason.includes(
      "mid-century",
    ) ||
    style
      ?.toLowerCase()
      .includes("mid-century")
  ) {
    return `Renovated Mid-Century in ${location}`;
  }

  if (
    reason.includes(
      "farmhouse",
    ) ||
    style
      ?.toLowerCase()
      .includes("farmhouse")
  ) {
    return `Farmhouse-Style Home in ${location}`;
  }

  if (
    reason.includes(
      "new construction",
    ) ||
    reason.includes(
      "new-construction",
    )
  ) {
    return `New Construction in ${location}`;
  }

  if (
    reason.includes(
      "contemporary",
    ) ||
    style
      ?.toLowerCase()
      .includes("contemporary")
  ) {
    return `Contemporary Home in ${location}`;
  }

  if (
    reason.includes(
      "craftsman",
    ) ||
    style
      ?.toLowerCase()
      .includes("craftsman")
  ) {
    return `Craftsman Home in ${location}`;
  }

  if (
    reason.includes(
      "mediterranean",
    ) ||
    style
      ?.toLowerCase()
      .includes("mediterranean")
  ) {
    return `Mediterranean-Style Home in ${location}`;
  }

  if (style) {
    return `${style} Home in ${location}`;
  }

  return `Home in ${location}`;
}

function extractCity(
  address: string,
): string | null {
  const match =
    address.match(
      /\s+(Beaverton|Portland|Hillsboro|Tigard|Lake Oswego|Sherwood|Tualatin|Aloha|Bethany|Vancouver|Camas|Ridgefield|Oregon City|Happy Valley),?\s+(?:OR|WA)\s+\d{5}/i,
    );

  return match?.[1] ?? null;
}

function createZillowUrl(
  address: string,
): string {
  const slug = address
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "-");

  return (
    `https://www.zillow.com/homes/` +
    `${encodeURIComponent(slug)}_rb/`
  );
}

function getPacificDateParts(): {
  isoDate: string;
  displayDate: string;
  slugDate: string;
} {
  const now = new Date();

  const isoDate =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).format(now);

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
    ).format(now);

  const slugDate =
    displayDate
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\s+/g, "-");

  return {
    isoDate,
    displayDate,
    slugDate,
  };
}

function formatNullableCurrency(
  value: number | null,
): string {
  if (value === null) {
    return "Not available";
  }

  const formatted =
    value.toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      },
    );

  return formatted.replace(
    "$",
    "\\$",
  );
}

function formatCurrencyCell(
  value: number | null,
): string {
  return value === null
    ? "Not available"
    : formatNullableCurrency(
        value,
      );
}

function formatReductionText(
  value: number | null,
): string {
  if (
    value === null ||
    value <= 0
  ) {
    return "Review current price history";
  }

  const rounded =
    Math.round(
      value / 1000,
    ) * 1000;

  return (
    `About ` +
    formatNullableCurrency(
      rounded,
    )
  );
}

function formatReductionCell(
  value: number | null,
): string {
  return formatReductionText(
    value,
  );
}

function formatBathrooms(
  full: number | null,
  partial: number | null,
): string {
  if (full === null) {
    return "Not available";
  }

  if (!partial) {
    return `${full} full`;
  }

  return (
    `${full} full, ` +
    `${partial} partial`
  );
}

function formatSquareFeet(
  value: number | null,
): string {
  return value === null
    ? "Not available"
    : value.toLocaleString(
        "en-US",
      );
}

function formatNullableNumber(
  value: number | null,
): string {
  return value === null
    ? "Not available"
    : value.toLocaleString(
        "en-US",
      );
}

function escapeYamlString(
  value: string,
): string {
  return value
    .replace(
      /\\/g,
      "\\\\",
    )
    .replace(
      /"/g,
      '\\"',
    )
    .replace(
      /\r?\n/g,
      " ",
    )
    .trim();
}

function escapeTableCell(
  value: string,
): string {
  return value.replace(
    /\|/g,
    "\\|",
  );
}

function escapeMarkdownAlt(
  value: string,
): string {
  return value
    .replace(
      /\[/g,
      "\\[",
    )
    .replace(
      /\]/g,
      "\\]",
    )
    .replace(
      /\r?\n/g,
      " ",
    )
    .trim();
}
