export interface EventCityConfig {
  name: string;
  stateCode: "OR" | "WA";
  slug: string;
}

/*
 * These are the primary Portland Metro / SW Washington markets
 * represented on Steven Tran Real Estate.
 *
 * Keep this list explicit rather than doing one giant Portland-radius
 * search. Ticketmaster supports city + state filtering, which prevents
 * events from being incorrectly assigned to a nearby city page.
 */
export const EVENT_CITIES: EventCityConfig[] = [
  { name: "Portland", stateCode: "OR", slug: "portland" },
  { name: "Beaverton", stateCode: "OR", slug: "beaverton" },
  { name: "Hillsboro", stateCode: "OR", slug: "hillsboro" },
  { name: "Tigard", stateCode: "OR", slug: "tigard" },
  { name: "Tualatin", stateCode: "OR", slug: "tualatin" },
  { name: "Sherwood", stateCode: "OR", slug: "sherwood" },
  { name: "Lake Oswego", stateCode: "OR", slug: "lake-oswego" },
  { name: "Oregon City", stateCode: "OR", slug: "oregon-city" },
  { name: "Happy Valley", stateCode: "OR", slug: "happy-valley" },
  { name: "Gresham", stateCode: "OR", slug: "gresham" },
  { name: "Milwaukie", stateCode: "OR", slug: "milwaukie" },
  { name: "Wilsonville", stateCode: "OR", slug: "wilsonville" },
  { name: "North Plains", stateCode: "OR", slug: "north-plains" },
  { name: "Forest Grove", stateCode: "OR", slug: "forest-grove" },
  { name: "Vancouver", stateCode: "WA", slug: "vancouver-wa" },
  { name: "Camas", stateCode: "WA", slug: "camas" },
  { name: "Washougal", stateCode: "WA", slug: "washougal" },
  { name: "Ridgefield", stateCode: "WA", slug: "ridgefield" },
];

export function getEventLookaheadDays(): number {
  return getPositiveIntegerEnv("EVENT_LOOKAHEAD_DAYS", 120);
}

export function getEventPageSize(): number {
  return getPositiveIntegerEnv("EVENT_PAGE_SIZE", 100);
}

export function getEventMaxPagesPerCity(): number {
  return getPositiveIntegerEnv("EVENT_MAX_PAGES_PER_CITY", 5);
}

/*
 * Ticketmaster's public API is rate limited. A conservative delay keeps
 * this scheduled job comfortably below the public request-per-second cap.
 */
export function getEventRequestDelayMs(): number {
  return getPositiveIntegerEnv("EVENT_REQUEST_DELAY_MS", 650);
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}
