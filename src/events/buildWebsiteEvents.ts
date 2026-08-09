import {
  EVENT_CITIES,
  getEventLookaheadDays,
  getEventRequestDelayMs,
} from "./config.js";
import { fetchTicketmasterEventsForCity } from "./ticketmaster.js";
import type { WebsiteEvent, WebsiteEventsFile } from "./types.js";

export async function buildWebsiteEvents(): Promise<WebsiteEventsFile> {
  const now = new Date();
  const lookaheadDays = getEventLookaheadDays();
  const requestDelayMs = getEventRequestDelayMs();
  const end = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const startDateTime = toTicketmasterDateTime(now);
  const endDateTime = toTicketmasterDateTime(end);

  console.log(`Fetching events through ${endDateTime}...`);

  const allEvents: WebsiteEvent[] = [];

  for (const [index, city] of EVENT_CITIES.entries()) {
    if (index > 0) {
      await delay(requestDelayMs);
    }

    console.log(`Fetching ${city.name}, ${city.stateCode}...`);

    const cityEvents = await fetchTicketmasterEventsForCity(
      city,
      startDateTime,
      endDateTime,
    );

    console.log(`  ${cityEvents.length} event(s)`);
    allEvents.push(...cityEvents);
  }

  const events = dedupeEvents(allEvents)
    .filter((event) => isDisplayableStatus(event.status))
    .sort(compareEvents);

  return {
    source: "Ticketmaster Discovery API",
    generatedAt: new Date().toISOString(),
    windowStart: startDateTime,
    windowEnd: endDateTime,
    cities: EVENT_CITIES.map((city) => city.slug),
    eventCount: events.length,
    events,
  };
}

function dedupeEvents(events: WebsiteEvent[]): WebsiteEvent[] {
  const byId = new Map<string, WebsiteEvent>();

  for (const event of events) {
    if (!byId.has(event.id)) {
      byId.set(event.id, event);
    }
  }

  return [...byId.values()];
}

function isDisplayableStatus(status: string | null): boolean {
  if (!status) {
    return true;
  }

  return !["canceled", "cancelled"].includes(status.toLowerCase());
}

function compareEvents(a: WebsiteEvent, b: WebsiteEvent): number {
  const aKey = a.startDateTime ?? `${a.startDate}T${a.startTime ?? "23:59:59"}`;
  const bKey = b.startDateTime ?? `${b.startDate}T${b.startTime ?? "23:59:59"}`;

  return aKey.localeCompare(bKey) || a.title.localeCompare(b.title);
}


function toTicketmasterDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
