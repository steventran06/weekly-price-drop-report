export type InstagramSlideLayout =
  | "cover"
  | "metro"
  | "ranking"
  | "comparison"
  | "insights"
  | "takeaway";

export interface InstagramRankingRow {
  rank: number;
  area: string;
  primary: string;
  secondary: string;
}

export interface InstagramInsightCard {
  title: string;
  body: string;
}

export interface InstagramCarouselSlide {
  filename: string;
  layout: InstagramSlideLayout;
  eyebrow: string;
  title: string;
  subtitle?: string;
  statLeft?: {
    value: string;
    label: string;
    detail?: string;
  };
  statRight?: {
    value: string;
    label: string;
    detail?: string;
  };
  rows?: InstagramRankingRow[];
  insights?: InstagramInsightCard[];
  body?: string;
  footer?: string;
}

export interface InstagramCarouselDefinition {
  reportDate: string;
  slug: string;
  caption: string;
  slides: InstagramCarouselSlide[];
}

export interface RenderedInstagramCarousel {
  outputDirectory: string;
  reportDate: string;
  slug: string;
  caption: string;
  svgPaths: string[];
  imagePaths: string[];
  manifestPath: string;
}
