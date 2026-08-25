export interface MortgageRatePoint {
  name: string;
  seriesId: string;
  rate: number;
  observationDate: string;
  previousRate: number | null;
  previousObservationDate: string | null;
  change: number | null;
  changeBps: number | null;
  fredUrl: string;
}

export interface MortgageRateSource {
  name: "Optimal Blue Mortgage Market Indices";
  provider: "Federal Reserve Bank of St. Louis (FRED)";
  releaseId: 473;
  releaseUrl: string;
  optimalBlueUrl: string;
}

export interface WebsiteMortgageRates {
  schemaVersion: 1;
  source: MortgageRateSource;
  fetchedAt: string;
  freshness: {
    latestObservationDate: string;
    oldestObservationDate: string;
    allSeriesSameObservationDate: boolean;
  };
  products: {
    conforming30: MortgageRatePoint;
    conforming30NonAdjusted: MortgageRatePoint;
    conforming15: MortgageRatePoint;
    jumbo30: MortgageRatePoint;
    fha30: MortgageRatePoint;
    va30: MortgageRatePoint;
    usda30: MortgageRatePoint;
  };
  conforming30ByFicoAndLtv: {
    ltv80OrLess: {
      ficoUnder680: MortgageRatePoint;
      fico680To699: MortgageRatePoint;
      fico700To719: MortgageRatePoint;
      fico720To739: MortgageRatePoint;
      fico740Plus: MortgageRatePoint;
    };
    ltvOver80: {
      ficoUnder680: MortgageRatePoint;
      fico680To699: MortgageRatePoint;
      fico700To719: MortgageRatePoint;
      fico720To739: MortgageRatePoint;
      fico740Plus: MortgageRatePoint;
    };
  };
}

export interface FredObservation {
  date: string;
  value: string;
}

export interface FredSeriesObservationsResponse {
  observations?: FredObservation[];
}
