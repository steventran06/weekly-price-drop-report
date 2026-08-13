export type RmlsLinkSelection =
  | "first"
  | "second"
  | "complete-list";

interface RmlsReportMatch {
  url: string;
  index: number;
}

export function extractRmlsReportLinks(
  value: string,
): string[] {
  return extractRmlsReportMatches(
    value,
  ).map(
    (match) =>
      match.url,
  );
}

export function selectRmlsReportLink(
  value: string,
  selection:
    RmlsLinkSelection,
): string | null {
  const matches =
    extractRmlsReportMatches(
      value,
    );

  if (
    matches.length ===
    0
  ) {
    return null;
  }

  if (
    selection ===
    "first"
  ) {
    return matches[0].url;
  }

  if (
    selection ===
    "second"
  ) {
    /*
     * RMLS auto-emails commonly include:
     *   1. newest matches
     *   2. complete list of available matches
     *
     * Price-drop workflows need the second RMLS
     * public-report URL. If an unusual/manual email
     * has only one RMLS URL, keep that usable fallback.
     */
    return (
      matches[1]?.url ??
      matches[0].url
    );
  }

  const completeList =
    findCompleteListMatch(
      value,
      matches,
    );

  if (
    completeList
  ) {
    return completeList.url;
  }

  /*
   * For normal RMLS auto-emails, the complete-list
   * link is also the second unique RMLS link.
   */
  return (
    matches[1]?.url ??
    matches[0].url
  );
}

function extractRmlsReportMatches(
  value: string,
): RmlsReportMatch[] {
  const normalized =
    decodeEmailEntities(
      value,
    );

  const reportPattern =
    /https?:\/\/(?:www\.)?rmlsweb\.com\/v2\/public\/report\.asp\?[^\s"'<>]+/gi;

  const rawMatches =
    Array.from(
      normalized.matchAll(
        reportPattern,
      ),
    ).map(
      (match) => ({
        url:
          cleanReportUrl(
            match[0],
          ),
        index:
          match.index ??
          0,
      }),
    );

  const seen =
    new Set<string>();

  const unique:
    RmlsReportMatch[] = [];

  for (
    const match
    of rawMatches
  ) {
    if (
      seen.has(
        match.url,
      )
    ) {
      continue;
    }

    seen.add(
      match.url,
    );

    unique.push(
      match,
    );
  }

  return unique;
}

function findCompleteListMatch(
  value: string,
  matches:
    RmlsReportMatch[],
): RmlsReportMatch | null {
  const normalized =
    decodeEmailEntities(
      value,
    );

  const directMatch =
    matches.find(
      (match) => {
        const contextStart =
          Math.max(
            0,
            match.index -
              300,
          );

        const context =
          normalizeEmailText(
            normalized.slice(
              contextStart,
              match.index,
            ),
          );

        return /complete\s+list\s+of\s+available\s+matches/i.test(
          context,
        );
      },
    );

  if (
    directMatch
  ) {
    return directMatch;
  }

  const lower =
    normalized.toLowerCase();

  const phraseIndex =
    lower.indexOf(
      "complete list of available matches",
    );

  if (
    phraseIndex < 0
  ) {
    return null;
  }

  return (
    matches
      .filter(
        (match) =>
          match.index >
          phraseIndex,
      )
      .sort(
        (a, b) =>
          a.index -
          b.index,
      )[0] ??
    null
  );
}

function decodeEmailEntities(
  value: string,
): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/\\u0026/gi, "&")
    .replace(/=\r?\n/g, "");
}

function cleanReportUrl(
  value: string,
): string {
  return value
    .replace(/[)>.,;]+$/g, "")
    .trim();
}

function normalizeEmailText(
  value: string,
): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
