export interface PriceDropCarouselCoverSlide {
  layout: "cover";
  filename: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  highlightValue: string | null;
  highlightLabel: string | null;
}

export interface PriceDropCarouselPropertySlide {
  layout: "property";
  filename: string;
  rank: number;
  address: string;
  currentPrice: number;
  originalPrice: number | null;
  totalPriceReduction: number | null;
  bedrooms: number | null;
  bathrooms: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  imageUrl: string | null;
  shortReason: string;
}

export interface PriceDropCarouselCtaSlide {
  layout: "cta";
  filename: string;
}

export type PriceDropCarouselSlide =
  | PriceDropCarouselCoverSlide
  | PriceDropCarouselPropertySlide
  | PriceDropCarouselCtaSlide;

export interface PriceDropCarouselDefinition {
  reportDate: string;
  slug: string;
  caption: string;
  slides: PriceDropCarouselSlide[];
}

export interface RenderedPriceDropCarousel {
  outputDirectory: string;
  reportDate: string;
  slug: string;
  caption: string;
  imagePaths: string[];
  manifestPath: string;
}
