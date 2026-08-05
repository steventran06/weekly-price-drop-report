export interface SelectedListing {
  rank: number;
  mlsNumber: string;
  address: string;
  currentPrice: number;
  originalPrice: number;
  totalPriceReduction: number;
  shortReason: string;
  concern: string;
  spokenLine: string;
}

export interface WeeklyAnalysis {
  title: string;
  summary: string;
  selectedListings: SelectedListing[];
  reelScript: string;
  instagramCaption: string;
  youtubeShortsTitle: string;
  youtubeShortsDescription: string;
  youtubeKeywords: string;
  factCheckNotes: string[];
}