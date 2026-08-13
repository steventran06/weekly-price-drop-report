import type {
  PlaylistVideoSummary,
  YoutubeVideo,
} from "./types.js";

const YOUTUBE_BASE = "https://www.youtube.com";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; weekly-price-drop-report/1.0; +https://steventranrealestate.com)",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchPlaylistVideos(
  playlistId: string,
): Promise<PlaylistVideoSummary[]> {
  const url =
    `${YOUTUBE_BASE}/playlist?list=${encodeURIComponent(playlistId)}`;

  const html = await fetchText(url);
  const initialData = extractJsonObject(html, [
    "var ytInitialData = ",
    "window[\"ytInitialData\"] = ",
    "ytInitialData = ",
  ]);

  if (!initialData) {
    throw new Error(
      `Could not find ytInitialData for playlist ${playlistId}.`,
    );
  }

  const videos = collectPlaylistVideos(initialData);

  if (videos.length === 0) {
    throw new Error(
      `Playlist ${playlistId} returned zero parsed videos. Refusing to publish an empty playlist.`,
    );
  }

  return videos;
}

export async function fetchVideoDetails(
  videoId: string,
): Promise<YoutubeVideo> {
  const url = `${YOUTUBE_BASE}/watch?v=${encodeURIComponent(videoId)}`;
  const html = await fetchText(url);

  const playerResponse = extractJsonObject(html, [
    "var ytInitialPlayerResponse = ",
    "ytInitialPlayerResponse = ",
    "window[\"ytInitialPlayerResponse\"] = ",
  ]);

  if (!playerResponse) {
    throw new Error(
      `Could not find ytInitialPlayerResponse for video ${videoId}.`,
    );
  }

  const videoDetails = asRecord(playerResponse.videoDetails);
  const microformat = asRecord(playerResponse.microformat);
  const playerMicroformat = asRecord(
    microformat?.playerMicroformatRenderer,
  );

  const title =
    typeof videoDetails?.title === "string"
      ? videoDetails.title.trim()
      : "";

  const description =
    typeof videoDetails?.shortDescription === "string"
      ? videoDetails.shortDescription
      : "";

  const publishDate =
    firstNonEmptyString([
      playerMicroformat?.publishDate,
      playerMicroformat?.uploadDate,
    ]) ?? "";

  if (!title) {
    throw new Error(`Video ${videoId} is missing a title.`);
  }

  if (!publishDate) {
    throw new Error(`Video ${videoId} is missing a publish date.`);
  }

  return {
    videoId,
    title,
    description,
    publishedAt: normalizePublishedAt(publishDate),
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    url: `${YOUTUBE_BASE}/watch?v=${videoId}`,
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(
      `YouTube request failed (${response.status}) for ${url}`,
    );
  }

  return response.text();
}

function collectPlaylistVideos(root: unknown): PlaylistVideoSummary[] {
  const results: PlaylistVideoSummary[] = [];
  const seen = new Set<string>();

  walk(root, (value) => {
    const record = asRecord(value);
    const renderer = asRecord(record?.playlistVideoRenderer);

    if (!renderer) {
      return;
    }

    const videoId =
      typeof renderer.videoId === "string"
        ? renderer.videoId
        : "";

    const title = readText(renderer.title);

    if (!videoId || !title || seen.has(videoId)) {
      return;
    }

    seen.add(videoId);
    results.push({ videoId, title });
  });

  return results;
}

function walk(
  value: unknown,
  visitor: (value: unknown) => void,
): void {
  visitor(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visitor);
    }
    return;
  }

  const record = asRecord(value);

  if (!record) {
    return;
  }

  for (const child of Object.values(record)) {
    walk(child, visitor);
  }
}

function readText(value: unknown): string {
  const record = asRecord(value);

  if (!record) {
    return "";
  }

  if (typeof record.simpleText === "string") {
    return record.simpleText.trim();
  }

  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => {
        const runRecord = asRecord(run);
        return typeof runRecord?.text === "string"
          ? runRecord.text
          : "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractJsonObject(
  html: string,
  markers: string[],
): Record<string, unknown> | null {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);

    if (markerIndex === -1) {
      continue;
    }

    const objectStart = html.indexOf("{", markerIndex + marker.length);

    if (objectStart === -1) {
      continue;
    }

    const jsonText = readBalancedObject(html, objectStart);

    if (!jsonText) {
      continue;
    }

    try {
      return JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function readBalancedObject(
  input: string,
  startIndex: number,
): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return input.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function normalizePublishedAt(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid YouTube publish date: ${value}`);
  }

  return date.toISOString();
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
