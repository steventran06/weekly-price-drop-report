export interface WebsiteEventLocation {
  venueName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface WebsiteEventImage {
  url: string;
  width: number | null;
  height: number | null;
  attribution: string | null;
}

export interface WebsiteEvent {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  startTime: string | null;
  startDateTime: string | null;
  endDate: string | null;
  endTime: string | null;
  endDateTime: string | null;
  timezone: string | null;
  status: string | null;
  citySlug: string;
  category: string | null;
  genre: string | null;
  subGenre: string | null;
  location: WebsiteEventLocation;
  image: WebsiteEventImage | null;
  source: {
    name: "Ticketmaster";
    url: string;
  };
}

export interface WebsiteEventsFile {
  source: "Ticketmaster Discovery API";
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  cities: string[];
  eventCount: number;
  events: WebsiteEvent[];
}
