const RMLS_SENDER =
  "noreply@rmlsweb.com";

const OREGON_TMO_SENDER =
  "staffannouncements+klrw573_at_kw.com@gaggle.email";

const WASHINGTON_TMO_SENDER =
  "waofficeannouncements+klrw573_at_kw.com@gaggle.email";

function envQuery(
  name: string,
  fallback: string,
): string {
  return (
    process.env[name]?.trim() ||
    fallback
  );
}

/**
 * Weekly price-drop source email.
 *
 * Gmail labels are intentionally not required. The downstream workflow
 * still validates that the message contains a usable RMLS report URL.
 */
export function getPriceDropGmailQuery(): string {
  return envQuery(
    "PRICE_DROP_GMAIL_QUERY",
    [
      "newer_than:7d",
      `from:${RMLS_SENDER}`,
      'subject:"PRICE CHANGE"',
    ].join(" "),
  );
}

export function getNewOnMarketGmailQuery(): string {
  return envQuery(
    "NEW_ON_MARKET_GMAIL_QUERY",
    [
      "newer_than:2d",
      `from:${RMLS_SENDER}`,
      'subject:"NEW ON MARKET"',
    ].join(" "),
  );
}

export function getOregonTmoGmailQuery(): string {
  return envQuery(
    "OREGON_TMO_GMAIL_QUERY",
    [
      "newer_than:10d",
      "has:attachment",
      `from:${OREGON_TMO_SENDER}`,
      'subject:"TMO Reports"',
    ].join(" "),
  );
}

export function getWashingtonTmoGmailQuery(): string {
  return envQuery(
    "WASHINGTON_TMO_GMAIL_QUERY",
    [
      "newer_than:10d",
      "has:attachment",
      `from:${WASHINGTON_TMO_SENDER}`,
      "subject:TMO",
    ].join(" "),
  );
}

/**
 * Monthly backfill queries omit newer_than because the caller appends
 * the explicit after:/before: range for the target month.
 */
export function getMonthlyTmoGmailQuery(): string {
  return envQuery(
    "MONTHLY_TMO_GMAIL_QUERY",
    [
      "has:attachment",
      `from:${OREGON_TMO_SENDER}`,
      'subject:"TMO Reports"',
    ].join(" "),
  );
}

export function getMonthlyPriceDropGmailQuery(): string {
  return envQuery(
    "MONTHLY_PRICE_DROP_GMAIL_QUERY",
    [
      `from:${RMLS_SENDER}`,
      'subject:"PRICE CHANGE"',
    ].join(" "),
  );
}
