import type {
  WeeklyAnalysis,
} from "../../analysis/types.js";

import type {
  RmlsListing,
} from "../../rmls/parseListings.js";

import type {
  PriceDropCarouselDefinition,
  PriceDropCarouselPropertySlide,
} from "./priceDropTypes.js";

const MAX_PROPERTY_SLIDES = 5;

export function buildPriceDropCarousel(
  analysis: WeeklyAnalysis,
  sourceListings: RmlsListing[],
): PriceDropCarouselDefinition {
  const reportDate = getPortlandDate();
  const slug = `price-drops-${reportDate}`;

  const sourcesByMls = new Map(
    sourceListings.map((listing) => [
      listing.mlsNumber,
      listing,
    ]),
  );

  const selected = [...analysis.selectedListings]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PROPERTY_SLIDES);

  if (selected.length === 0) {
    throw new Error(
      "Cannot build a price-drop carousel without selected listings.",
    );
  }

  const propertySlides: PriceDropCarouselPropertySlide[] =
    selected.map((selection, index) => {
      const source = sourcesByMls.get(
        selection.mlsNumber,
      );

      if (!source) {
        throw new Error(
          `Price-drop carousel could not find MLS ${selection.mlsNumber} in the parsed source listings.`,
        );
      }

      return {
        layout: "property",
        filename: `${String(index + 2).padStart(2, "0")}-home-${selection.rank}.jpg`,
        rank: selection.rank,
        address: selection.address,
        currentPrice: selection.currentPrice,
        originalPrice: selection.originalPrice,
        totalPriceReduction:
          selection.totalPriceReduction,
        bedrooms: source.bedrooms,
        bathrooms: formatBathrooms(
          source.fullBathrooms,
          source.partialBathrooms,
        ),
        squareFeet: source.squareFeet,
        yearBuilt: source.yearBuilt,
        imageUrl:
          source.imageUrl ||
          source.imageUrls?.[0] ||
          null,
        shortReason: shortenReason(
          selection.shortReason,
        ),
      };
    });

  const verifiedReductions = propertySlides
    .map((slide) => slide.totalPriceReduction)
    .filter(
      (value): value is number =>
        value !== null && value > 0,
    );

  const largestVerifiedReduction =
    verifiedReductions.length > 0
      ? Math.max(...verifiedReductions)
      : null;

  return {
    reportDate,
    slug,
    caption: buildCaption(),
    slides: [
      {
        layout: "cover",
        filename: "01-cover.jpg",
        title: "PORTLAND METRO\nPRICE DROPS",
        subtitle:
          "Five selected homes that stood out in this week's price-drop report.",
        dateLabel: formatDisplayDate(reportDate),
        highlightValue:
          largestVerifiedReduction !== null
            ? formatCompactCurrency(
                largestVerifiedReduction,
              )
            : null,
        highlightLabel:
          largestVerifiedReduction !== null
            ? "LARGEST VERIFIED REDUCTION\nAMONG THESE PICKS"
            : null,
      },
      ...propertySlides,
      {
        layout: "cta",
        filename: `${String(propertySlides.length + 2).padStart(2, "0")}-cta.jpg`,
      },
    ],
  };
}

function buildCaption(): string {
  return [
    "Portland Metro price drops this week 🏡",
    "",
    "Here are five homes that stood out from this week's price-drop report. Swipe through for current price, original list price, property details and the total reduction from the original list price when available.",
    "",
    "Want current listing details, photos, disclosures, showing availability or recent comparable sales for any of these homes? Visit PortlandHomeGuide.com.",
    "",
    "Listings, pricing and availability can change at any time. Featured homes may be listed by brokers other than the operators of Portland Home Guide.",
    "",
    "#PortlandRealEstate #PortlandHomeGuide #PortlandMetro #PriceDrops #HomesForSale",
  ].join("\n");
}

function getPortlandDate(): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;
  const month = parts.find(
    (part) => part.type === "month",
  )?.value;
  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Could not determine Portland date for price-drop carousel.",
    );
  }

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(
  isoDate: string,
): string {
  const [year, month, day] = isoDate
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "UTC",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function formatBathrooms(
  full: number | null,
  partial: number | null,
): string {
  if (full === null) {
    return "—";
  }

  if (!partial) {
    return String(full);
  }

  return String(full + partial * 0.5);
}

function formatCompactCurrency(
  value: number,
): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions.toFixed(
      millions >= 10 ? 0 : 1,
    )}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }

  return `$${Math.round(value)}`;
}

function shortenReason(
  value: string,
): string {
  const cleaned = value
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 165) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, 162);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${truncated.slice(
    0,
    Math.max(lastSpace, 120),
  )}…`;
}
