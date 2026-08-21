interface InstagramCreateContainerResponse {
  id?: string;
}

interface InstagramContainerStatusResponse {
  id?: string;
  status_code?: string;
  status?: string;
}

interface InstagramPublishResponse {
  id?: string;
}

export interface PublishInstagramCarouselInput {
  apiVersion: string;
  userId: string;
  accessToken: string;
  imageUrls: string[];
  caption: string;
}

export async function publishInstagramCarousel(
  input: PublishInstagramCarouselInput,
): Promise<string> {
  if (
    input.imageUrls.length < 2 ||
    input.imageUrls.length > 10
  ) {
    throw new Error(
      `Instagram carousel requires 2 to 10 images. Received ${input.imageUrls.length}.`,
    );
  }

  const baseUrl =
    `https://graph.instagram.com/${input.apiVersion}`;

  console.log("");
  console.log(
    `Creating ${input.imageUrls.length} Instagram carousel item containers...`,
  );

  const childIds:
    string[] = [];

  for (
    const imageUrl
    of input.imageUrls
  ) {
    const result =
      await instagramRequest<InstagramCreateContainerResponse>(
        `${baseUrl}/${input.userId}/media`,
        input.accessToken,
        {
          image_url:
            imageUrl,
          is_carousel_item:
            true,
        },
      );

    if (!result.id) {
      throw new Error(
        `Instagram did not return a child container ID for ${imageUrl}.`,
      );
    }

    await waitForContainer(
      baseUrl,
      result.id,
      input.accessToken,
    );

    childIds.push(
      result.id,
    );
  }

  console.log(
    "Creating Instagram carousel container...",
  );

  const carousel =
    await instagramRequest<InstagramCreateContainerResponse>(
      `${baseUrl}/${input.userId}/media`,
      input.accessToken,
      {
        media_type:
          "CAROUSEL",
        children:
          childIds.join(
            ",",
          ),
        caption:
          input.caption,
      },
    );

  if (!carousel.id) {
    throw new Error(
      "Instagram did not return a carousel container ID.",
    );
  }

  await waitForContainer(
    baseUrl,
    carousel.id,
    input.accessToken,
  );

  console.log(
    "Publishing Instagram carousel...",
  );

  const published =
    await instagramRequest<InstagramPublishResponse>(
      `${baseUrl}/${input.userId}/media_publish`,
      input.accessToken,
      {
        creation_id:
          carousel.id,
      },
    );

  if (!published.id) {
    throw new Error(
      "Instagram did not return a published media ID.",
    );
  }

  return published.id;
}

async function waitForContainer(
  baseUrl: string,
  containerId: string,
  accessToken: string,
): Promise<void> {
  const attempts =
    30;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {
    const url =
      `${baseUrl}/${containerId}?fields=status_code,status`;

    const status =
      await instagramGet<InstagramContainerStatusResponse>(
        url,
        accessToken,
      );

    const code =
      status.status_code?.toUpperCase();

    if (
      code === "FINISHED" ||
      code === "PUBLISHED"
    ) {
      return;
    }

    if (
      code === "ERROR" ||
      code === "EXPIRED"
    ) {
      throw new Error(
        `Instagram container ${containerId} failed: ${status.status || code}`,
      );
    }

    await sleep(
      3_000,
    );
  }

  throw new Error(
    `Instagram container ${containerId} did not finish processing in time.`,
  );
}

async function instagramRequest<T>(
  url: string,
  accessToken: string,
  body: Record<
    string,
    unknown
  >,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        method:
          "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          "User-Agent":
            "weekly-price-drop-report",
        },
        body:
          JSON.stringify(
            body,
          ),
      },
    );

  return await parseInstagramResponse<T>(
    response,
  );
}

async function instagramGet<T>(
  url: string,
  accessToken: string,
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        method:
          "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "User-Agent":
            "weekly-price-drop-report",
        },
      },
    );

  return await parseInstagramResponse<T>(
    response,
  );
}

async function parseInstagramResponse<T>(
  response: Response,
): Promise<T> {
  const text =
    await response.text();

  let parsed:
    unknown = null;

  try {
    parsed =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    parsed =
      text;
  }

  if (!response.ok) {
    throw new Error(
      `Instagram API request failed (${response.status}): ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
    );
  }

  return parsed as T;
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
