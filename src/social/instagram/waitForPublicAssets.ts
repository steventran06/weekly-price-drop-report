export async function waitForPublicAssets(
  urls: string[],
): Promise<void> {
  const timeoutMs =
    parsePositiveInteger(
      process.env.INSTAGRAM_ASSET_WAIT_TIMEOUT_MS,
      240_000,
    );

  const intervalMs =
    parsePositiveInteger(
      process.env.INSTAGRAM_ASSET_WAIT_INTERVAL_MS,
      10_000,
    );

  const deadline =
    Date.now() +
    timeoutMs;

  console.log("");
  console.log(
    "Waiting for generated Instagram images to become publicly reachable...",
  );

  while (
    Date.now() < deadline
  ) {
    const checks =
      await Promise.all(
        urls.map(
          checkAsset,
        ),
      );

    if (
      checks.every(Boolean)
    ) {
      console.log(
        "All Instagram images are publicly reachable.",
      );
      return;
    }

    const readyCount =
      checks.filter(Boolean).length;

    console.log(
      `Public assets ready: ${readyCount}/${urls.length}. Retrying...`,
    );

    await sleep(
      intervalMs,
    );
  }

  throw new Error(
    "Timed out waiting for Instagram images to become public. " +
      "Check the website deploy and INSTAGRAM_ASSET_BASE_URL before publishing.",
  );
}

async function checkAsset(
  url: string,
): Promise<boolean> {
  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",
          headers: {
            "User-Agent":
              "weekly-price-drop-report",
          },
        },
      );

    if (!response.ok) {
      return false;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) || "";

    return contentType
      .toLowerCase()
      .includes(
        "image/",
      );
  } catch {
    return false;
  }
}

function sleep(
  ms: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) {
    return fallback;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}
