export const MORTGAGE_RATE_SERIES = {
  conforming30: {
    seriesId: "OBMMIC30YF",
    name: "30-Year Fixed Rate Conforming Mortgage Index",
  },
  conforming30NonAdjusted: {
    seriesId: "OBMMIC30YFNA",
    name: "30-Year Fixed Rate Conforming Non-Adjusted Mortgage Index",
  },
  conforming15: {
    seriesId: "OBMMIC15YF",
    name: "15-Year Fixed Rate Conforming Mortgage Index",
  },
  jumbo30: {
    seriesId: "OBMMIJUMBO30YF",
    name: "30-Year Fixed Rate Jumbo Mortgage Index",
  },
  fha30: {
    seriesId: "OBMMIFHA30YF",
    name: "30-Year Fixed Rate FHA Mortgage Index",
  },
  va30: {
    seriesId: "OBMMIVA30YF",
    name: "30-Year Fixed Rate Veterans Affairs Mortgage Index",
  },
  usda30: {
    seriesId: "OBMMIUSDA30YF",
    name: "30-Year Fixed Rate USDA Mortgage Index",
  },
  ltv80OrLessFicoUnder680: {
    seriesId: "OBMMIC30YFLVLE80FLT680",
    name: "30-Year Conforming, LTV <=80%, FICO <680",
  },
  ltv80OrLessFico680To699: {
    seriesId: "OBMMIC30YFLVLE80FB680A699",
    name: "30-Year Conforming, LTV <=80%, FICO 680-699",
  },
  ltv80OrLessFico700To719: {
    seriesId: "OBMMIC30YFLVLE80FB700A719",
    name: "30-Year Conforming, LTV <=80%, FICO 700-719",
  },
  ltv80OrLessFico720To739: {
    seriesId: "OBMMIC30YFLVLE80FB720A739",
    name: "30-Year Conforming, LTV <=80%, FICO 720-739",
  },
  ltv80OrLessFico740Plus: {
    seriesId: "OBMMIC30YFLVLE80FGE740",
    name: "30-Year Conforming, LTV <=80%, FICO 740+",
  },
  ltvOver80FicoUnder680: {
    seriesId: "OBMMIC30YFLVGT80FLT680",
    name: "30-Year Conforming, LTV >80%, FICO <680",
  },
  ltvOver80Fico680To699: {
    seriesId: "OBMMIC30YFLVGT80FB680A699",
    name: "30-Year Conforming, LTV >80%, FICO 680-699",
  },
  ltvOver80Fico700To719: {
    seriesId: "OBMMIC30YFLVGT80FB700A719",
    name: "30-Year Conforming, LTV >80%, FICO 700-719",
  },
  ltvOver80Fico720To739: {
    seriesId: "OBMMIC30YFLVGT80FB720A739",
    name: "30-Year Conforming, LTV >80%, FICO 720-739",
  },
  ltvOver80Fico740Plus: {
    seriesId: "OBMMIC30YFLVGT80FGE740",
    name: "30-Year Conforming, LTV >80%, FICO 740+",
  },
} as const;

export type MortgageRateSeriesKey =
  keyof typeof MORTGAGE_RATE_SERIES;
