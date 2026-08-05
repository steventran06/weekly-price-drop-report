export interface SelectedListing {
  rank: number;
  mlsNumber: string;
  address: string;
  currentPrice: number;
  exactDropPlaceholder: string;
  shortReason: string;
  concern: string;
  spokenLine: string;
}

export interface WeeklyAnalysis {
  title: string;
  summary: string;
  selectedListings: SelectedListing[];
  reelScript: string;
  factCheckNotes: string[];
}