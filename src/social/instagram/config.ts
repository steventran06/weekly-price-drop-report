export interface InstagramAutomationConfig {
  enabled: boolean;
  autoPublish: boolean;
  apiVersion: string;
  userId: string | null;
  accessToken: string | null;
  assetBaseUrl: string | null;
  githubPath: string;
  brand: {
    primary: string;
    background: string;
    accent: string;
    text: string;
    muted: string;
    lavender: string;
    skyBlue: string;
    coral: string;
    card: string;
    divider: string;
  };
}

export function getInstagramAutomationConfig(): InstagramAutomationConfig {
  return {
    enabled:
      readBoolean(
        "INSTAGRAM_ENABLED",
        true,
      ),

    autoPublish:
      readBoolean(
        "INSTAGRAM_AUTO_PUBLISH",
        false,
      ),

    apiVersion:
      process.env.INSTAGRAM_API_VERSION?.trim() ||
      "v25.0",

    userId:
      optionalEnv(
        "INSTAGRAM_USER_ID",
      ),

    accessToken:
      optionalEnv(
        "INSTAGRAM_ACCESS_TOKEN",
      ),

    assetBaseUrl:
      optionalEnv(
        "INSTAGRAM_ASSET_BASE_URL",
      ),

    githubPath:
      (
        process.env.INSTAGRAM_GITHUB_ASSET_PATH?.trim() ||
        "public/generated/instagram/market-stats"
      ).replace(
        /^\/+|\/+$/g,
        "",
      ),

    brand: {
      // Portland Airport carpet palette:
      // https://www.color-hex.com/color-palette/1047768
      primary:
        process.env.INSTAGRAM_BRAND_PRIMARY?.trim() ||
        "#5C7CB9",

      accent:
        process.env.INSTAGRAM_BRAND_ACCENT?.trim() ||
        "#62CAC9",

      lavender:
        process.env.INSTAGRAM_BRAND_LAVENDER?.trim() ||
        "#D0B6E3",

      skyBlue:
        process.env.INSTAGRAM_BRAND_SKY_BLUE?.trim() ||
        "#6992E1",

      coral:
        process.env.INSTAGRAM_BRAND_CORAL?.trim() ||
        "#FA687F",

      background:
        process.env.INSTAGRAM_BRAND_BACKGROUND?.trim() ||
        "#F7F9FC",

      card:
        process.env.INSTAGRAM_BRAND_CARD?.trim() ||
        "#FFFFFF",

      text:
        process.env.INSTAGRAM_BRAND_TEXT?.trim() ||
        "#17212B",

      muted:
        process.env.INSTAGRAM_BRAND_MUTED?.trim() ||
        "#66717E",

      divider:
        process.env.INSTAGRAM_BRAND_DIVIDER?.trim() ||
        "#DDE5EC",
    },
  };
}

function optionalEnv(
  name: string,
): string | null {
  const value =
    process.env[name]?.trim();

  return value || null;
}

function readBoolean(
  name: string,
  defaultValue: boolean,
): boolean {
  const raw =
    process.env[name]?.trim().toLowerCase();

  if (!raw) {
    return defaultValue;
  }

  if (
    [
      "1",
      "true",
      "yes",
      "on",
    ].includes(raw)
  ) {
    return true;
  }

  if (
    [
      "0",
      "false",
      "no",
      "off",
    ].includes(raw)
  ) {
    return false;
  }

  throw new Error(
    `${name} must be true or false. Received: ${raw}`,
  );
}
