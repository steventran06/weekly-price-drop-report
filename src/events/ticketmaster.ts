import {
  getEventMaxPagesPerCity,
  getEventPageSize,
  getEventRequestDelayMs,
  type EventCityConfig,
} from "./config.js";
import type { WebsiteEvent, WebsiteEventImage } from "./types.js";

interface TicketmasterImage {
  url?: string;
  width?: number;
  height?: number;
  ratio?: string;
  fallback?: boolean;
  attribution?: string;
}

interface TicketmasterClassification {
  primary?: boolean;
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
}

interface TicketmasterVenue {
  name?: string;
  postalCode?: string;
  timezone?: string;
  city?: { name?: string };
  state?: { name?: string; stateCode?: string };
  address?: { line1?: string };
  location?: { latitude?: string; longitude?: string };
}

interface TicketmasterEvent {
  id?: string;
  name?: string;
  url?: string;
  images?: TicketmasterImage[];
  classifications?: TicketmasterClassification[];
  dates?: {
    timezone?: string;
    status?: { code?: string };
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    end?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    number?: number;
    totalPages?: number;
    totalElements?: number;
  };
}

const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

export async function fetchTicketmasterEventsForCity(
  city: EventCityConfig,
  startDateTime: string,
  endDateTime: string,
): Promise<WebsiteEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY is required to fetch events.");
  }

  const events: WebsiteEvent[] = [];

  const maxPages = getEventMaxPagesPerCity();
  const requestDelayMs = getEventRequestDelayMs();

  for (let page = 0; page < maxPages; page += 1) {
    if (page > 0) {
      await delay(requestDelayMs);
    }

    const response = await fetchTicketmasterPage(
      apiKey,
      city,
      startDateTime,
      endDateTime,
      page,
    );

    const rawEvents = response._embedded?.events ?? [];

    for (const rawEvent of rawEvents) {
      const normalized = normalizeTicketmasterEvent(rawEvent, city);

      if (normalized) {
        events.push(normalized);
      }
    }

    const totalPages = response.page?.totalPages ?? 0;

    if (page + 1 >= totalPages) {
      break;
    }

    if (page + 1 >= maxPages) {
      console.warn(
        `Reached EVENT_MAX_PAGES_PER_CITY for ${city.name}. ` +
          `Ticketmaster reported ${totalPages} page(s).`,
      );
    }
  }

  return events;
}

async function fetchTicketmasterPage(
  apiKey: string,
  city: EventCityConfig,
  startDateTime: string,
  endDateTime: string,
  page: number,
): Promise<TicketmasterResponse> {
  const params = new URLSearchParams({
    apikey: apiKey,
    city: city.name,
    stateCode: city.stateCode,
    countryCode: "US",
    startDateTime,
    endDateTime,
    includeTBA: "no",
    includeTBD: "no",
    includeTest: "no",
    sort: "date,asc",
    size: String(getEventPageSize()),
    page: String(page),
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "weekly-price-drop-report-events",
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Ticketmaster fetch failed for ${city.name}, ${city.stateCode} ` +
        `(page ${page}, HTTP ${response.status}): ${body}`,
    );
  }

  return (await response.json()) as TicketmasterResponse;
}

function normalizeTicketmasterEvent(
  event: TicketmasterEvent,
  requestedCity: EventCityConfig,
): WebsiteEvent | null {
  const id = event.id?.trim();
  const title = event.name?.trim();
  const sourceUrl = event.url?.trim();
  const startDate = event.dates?.start?.localDate?.trim();

  if (!id || !title || !sourceUrl || !startDate) {
    return null;
  }

  const venue = event._embedded?.venues?.[0];
  const classification =
    event.classifications?.find((item) => item.primary) ??
    event.classifications?.[0];

  const latitude = parseCoordinate(venue?.location?.latitude);
  const longitude = parseCoordinate(venue?.location?.longitude);

  return {
    id: `ticketmaster:${id}`,
    title,
    slug: slugify(`${title}-${startDate}`),
    startDate,
    startTime: event.dates?.start?.localTime?.trim() || null,
    startDateTime: event.dates?.start?.dateTime?.trim() || null,
    endDate: event.dates?.end?.localDate?.trim() || null,
    endTime: event.dates?.end?.localTime?.trim() || null,
    endDateTime: event.dates?.end?.dateTime?.trim() || null,
    timezone:
      event.dates?.timezone?.trim() || venue?.timezone?.trim() || null,
    status: event.dates?.status?.code?.trim() || null,
    citySlug: requestedCity.slug,
    category: classification?.segment?.name?.trim() || null,
    genre: classification?.genre?.name?.trim() || null,
    subGenre: classification?.subGenre?.name?.trim() || null,
    location: {
      venueName: venue?.name?.trim() || null,
      address: venue?.address?.line1?.trim() || null,
      city: venue?.city?.name?.trim() || requestedCity.name,
      state: venue?.state?.name?.trim() || null,
      stateCode: venue?.state?.stateCode?.trim() || requestedCity.stateCode,
      postalCode: venue?.postalCode?.trim() || null,
      latitude,
      longitude,
    },
    image: pickEventImage(event.images ?? []),
    source: {
      name: "Ticketmaster",
      url: sourceUrl,
    },
  };
}

function pickEventImage(images: TicketmasterImage[]): WebsiteEventImage | null {
  const candidates = images.filter((image) => Boolean(image.url));

  if (candidates.length === 0) {
    return null;
  }

  const preferred =
    candidates
      .filter((image) => image.ratio === "16_9" && !image.fallback)
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ??
    candidates
      .filter((image) => image.ratio === "16_9")
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ??
    candidates.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  if (!preferred?.url) {
    return null;
  }

  return {
    url: preferred.url,
    width: preferred.width ?? null,
    height: preferred.height ?? null,
    attribution: preferred.attribution?.trim() || null,
  };
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
