export interface YoutubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

export interface YoutubePlaylistConfig {
  key: string;
  title: string;
  playlistId: string;
}

export interface YoutubePlaylistFile {
  title: string;
  playlistId: string;
  playlistUrl: string;
  videos: YoutubeVideo[];
}

export interface YoutubeWebsiteFile {
  generatedAt: string;
  [key: string]: string | YoutubePlaylistFile;
}

export interface PlaylistVideoSummary {
  videoId: string;
  title: string;
}
