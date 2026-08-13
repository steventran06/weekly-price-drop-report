export const LOCAL_SUBREDDITS = [
  "Portland",
  "PortlandOR",
  "AskPortland",
  "Beaverton",
  "Hillsboro",
  "HillsboroOR",
  "Tigard",
  "VancouverWA",
  "CamasWashington",
  "Ridgefield",
] as const;

export const RELOCATION_SUBREDDITS = [
  "relocating",
  "SameGrassButGreener",
  "Moving",
] as const;

export const LIVING_SUBREDDITS = [
  "howislivingthere",
] as const;

export const BUYER_SUBREDDITS = [
  "FirstTimeHomeBuyer",
  "RealEstate",
] as const;

export type SubredditContext =
  | "local"
  | "relocation"
  | "living"
  | "buyer"
  | "other";

export function getSubredditContext(
  subreddit: string | null | undefined,
): SubredditContext {
  const normalized = (subreddit ?? "").trim().toLowerCase();

  if (containsNormalized(LOCAL_SUBREDDITS, normalized)) {
    return "local";
  }

  if (containsNormalized(RELOCATION_SUBREDDITS, normalized)) {
    return "relocation";
  }

  if (containsNormalized(LIVING_SUBREDDITS, normalized)) {
    return "living";
  }

  if (containsNormalized(BUYER_SUBREDDITS, normalized)) {
    return "buyer";
  }

  return "other";
}

function containsNormalized(
  values: readonly string[],
  normalized: string,
): boolean {
  return values.some(
    (value) => value.toLowerCase() === normalized,
  );
}
