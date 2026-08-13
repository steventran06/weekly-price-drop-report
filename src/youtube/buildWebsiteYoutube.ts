import { YOUTUBE_PLAYLISTS } from "./config.js";
import {
  fetchPlaylistVideos,
  fetchVideoDetails,
} from "./fetchPlaylist.js";
import type {
  YoutubePlaylistFile,
  YoutubeVideo,
  YoutubeWebsiteFile,
} from "./types.js";

const YOUTUBE_BASE = "https://www.youtube.com";

export async function buildWebsiteYoutube(
  existing: YoutubeWebsiteFile | null,
): Promise<YoutubeWebsiteFile> {
  const output: YoutubeWebsiteFile = {
    generatedAt: new Date().toISOString(),
  };

  const refreshAll = /^true$/i.test(
    process.env.YOUTUBE_REFRESH_ALL?.trim() ?? "false",
  );

  for (const playlist of YOUTUBE_PLAYLISTS) {
    console.log("");
    console.log(`Fetching YouTube playlist: ${playlist.title}`);

    const summaries = await fetchPlaylistVideos(playlist.playlistId);
    const previousPlaylist = getExistingPlaylist(existing, playlist.key);
    const previousById = new Map(
      (previousPlaylist?.videos ?? []).map((video) => [video.videoId, video]),
    );

    const videos: YoutubeVideo[] = [];

    for (const summary of summaries) {
      const previous = previousById.get(summary.videoId);

      if (previous && !refreshAll) {
        videos.push({
          ...previous,
          title: summary.title,
          thumbnail:
            previous.thumbnail ||
            `https://i.ytimg.com/vi/${summary.videoId}/maxresdefault.jpg`,
          url: `${YOUTUBE_BASE}/watch?v=${summary.videoId}`,
        });
        continue;
      }

      console.log(
        `${previous ? "Refreshing" : "Fetching new"} video: ${summary.title}`,
      );

      const details = await fetchVideoDetails(summary.videoId);
      videos.push({
        ...details,
        title: summary.title || details.title,
      });
    }

    if (videos.length === 0) {
      throw new Error(
        `Refusing to build YouTube data because ${playlist.title} has no videos.`,
      );
    }

    const playlistFile: YoutubePlaylistFile = {
      title: playlist.title,
      playlistId: playlist.playlistId,
      playlistUrl:
        `${YOUTUBE_BASE}/playlist?list=${playlist.playlistId}`,
      videos,
    };

    output[playlist.key] = playlistFile;

    console.log(
      `YouTube playlist complete: ${playlist.title} (${videos.length} videos)`,
    );
  }

  validateWebsiteYoutube(output);
  return output;
}

export function validateWebsiteYoutube(data: YoutubeWebsiteFile): void {
  if (!data.generatedAt || Number.isNaN(new Date(data.generatedAt).getTime())) {
    throw new Error("YouTube data is missing a valid generatedAt timestamp.");
  }

  for (const playlist of YOUTUBE_PLAYLISTS) {
    const value = getExistingPlaylist(data, playlist.key);

    if (!value) {
      throw new Error(`YouTube data is missing playlist ${playlist.key}.`);
    }

    if (value.playlistId !== playlist.playlistId) {
      throw new Error(`Unexpected playlist ID for ${playlist.key}.`);
    }

    if (!Array.isArray(value.videos) || value.videos.length === 0) {
      throw new Error(`YouTube playlist ${playlist.key} has no videos.`);
    }

    const seen = new Set<string>();

    for (const video of value.videos) {
      if (!video.videoId || !video.title || !video.url) {
        throw new Error(`Invalid video found in playlist ${playlist.key}.`);
      }

      if (seen.has(video.videoId)) {
        throw new Error(
          `Duplicate video ${video.videoId} found in playlist ${playlist.key}.`,
        );
      }

      seen.add(video.videoId);
    }
  }
}

function getExistingPlaylist(
  data: YoutubeWebsiteFile | null,
  key: string,
): YoutubePlaylistFile | null {
  const value = data?.[key];

  if (!value || typeof value === "string") {
    return null;
  }

  return value;
}
