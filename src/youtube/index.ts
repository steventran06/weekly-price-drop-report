import {
  getExistingWebsiteYoutube,
  publishWebsiteYoutube,
} from "../github/publishWebsiteYoutube.js";
import {
  buildWebsiteYoutube,
} from "./buildWebsiteYoutube.js";

export async function updateWebsiteYoutube(): Promise<string> {
  console.log("");
  console.log("================================");
  console.log(" YouTube Playlist Sync");
  console.log("================================");

  const existing = await getExistingWebsiteYoutube();

  if (existing) {
    console.log("Loaded existing website youtube.json for metadata reuse.");
  } else {
    console.log("No existing website youtube.json found; fetching full video metadata.");
  }

  const data = await buildWebsiteYoutube(existing);
  const url = await publishWebsiteYoutube(data);

  console.log(`Published YouTube data: ${url}`);
  return url;
}
