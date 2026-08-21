import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type {
  InstagramAutomationConfig,
} from "./config.js";

import type {
  PriceDropCarouselDefinition,
  PriceDropCarouselPropertySlide,
  PriceDropCarouselSlide,
  RenderedPriceDropCarousel,
} from "./priceDropTypes.js";

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_TOP = 138;
const PHOTO_HEIGHT = 562;
const MAX_IMAGE_BYTES = 15_000_000;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

export async function renderPriceDropCarousel(
  definition: PriceDropCarouselDefinition,
  config: InstagramAutomationConfig,
): Promise<RenderedPriceDropCarousel> {
  const outputDirectory = path.join(
    process.cwd(),
    "output",
    "price-drops",
    "instagram",
    definition.slug,
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const logoDataUri = await loadBrandLogoDataUri(
    config.brand.logoPath,
  );

  const imagePaths: string[] = [];

  for (const [index, slide] of definition.slides.entries()) {
    const imagePath = path.join(
      outputDirectory,
      slide.filename,
    );

    await renderSlide(
      slide,
      index + 1,
      definition.slides.length,
      config,
      logoDataUri,
      imagePath,
    );

    imagePaths.push(imagePath);
  }

  const captionPath = path.join(
    outputDirectory,
    "caption.txt",
  );

  const manifestPath = path.join(
    outputDirectory,
    "manifest.json",
  );

  await Promise.all([
    fs.writeFile(
      captionPath,
      `${definition.caption}\n`,
      "utf8",
    ),
    fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          reportDate: definition.reportDate,
          slug: definition.slug,
          dimensions: {
            width: WIDTH,
            height: HEIGHT,
            aspectRatio: "4:5",
          },
          caption: definition.caption,
          images: imagePaths.map((imagePath) =>
            path.basename(imagePath),
          ),
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ),
  ]);

  return {
    outputDirectory,
    reportDate: definition.reportDate,
    slug: definition.slug,
    caption: definition.caption,
    imagePaths,
    manifestPath,
  };
}

async function renderSlide(
  slide: PriceDropCarouselSlide,
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
  logoDataUri: string,
  imagePath: string,
): Promise<void> {
  if (slide.layout === "property") {
    await renderPropertySlide(
      slide,
      slideNumber,
      totalSlides,
      config,
      logoDataUri,
      imagePath,
    );
    return;
  }

  const svg =
    slide.layout === "cover"
      ? renderCoverSvg(
          slide,
          slideNumber,
          totalSlides,
          config,
          logoDataUri,
        )
      : renderCtaSvg(
          slideNumber,
          totalSlides,
          config,
          logoDataUri,
        );

  await sharp(Buffer.from(svg))
    .jpeg({
      quality: 92,
      mozjpeg: true,
    })
    .toFile(imagePath);
}

async function renderPropertySlide(
  slide: PriceDropCarouselPropertySlide,
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
  logoDataUri: string,
  imagePath: string,
): Promise<void> {
  const photo = await loadPropertyPhoto(
    slide.imageUrl,
    config,
  );

  const overlaySvg = renderPropertyOverlaySvg(
    slide,
    slideNumber,
    totalSlides,
    config,
    logoDataUri,
  );

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: config.brand.background,
    },
  })
    .composite([
      {
        input: photo,
        left: 0,
        top: PHOTO_TOP,
      },
      {
        input: Buffer.from(overlaySvg),
        left: 0,
        top: 0,
      },
    ])
    .jpeg({
      quality: 92,
      mozjpeg: true,
    })
    .toFile(imagePath);
}

async function loadPropertyPhoto(
  imageUrl: string | null,
  config: InstagramAutomationConfig,
): Promise<Buffer> {
  if (imageUrl) {
    try {
      const imageBuffer = await fetchImageBuffer(
        imageUrl,
      );

      return await sharp(imageBuffer)
        .rotate()
        .resize(WIDTH, PHOTO_HEIGHT, {
          fit: "cover",
          position: "centre",
        })
        .jpeg({
          quality: 90,
        })
        .toBuffer();
    } catch (error) {
      console.warn(
        `Could not load property photo ${imageUrl}; using branded fallback. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${PHOTO_HEIGHT}" viewBox="0 0 ${WIDTH} ${PHOTO_HEIGHT}">
  <defs>
    <linearGradient id="fallback" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(config.brand.primary)}" />
      <stop offset="55%" stop-color="${escapeXml(config.brand.skyBlue)}" />
      <stop offset="100%" stop-color="${escapeXml(config.brand.accent)}" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${PHOTO_HEIGHT}" fill="url(#fallback)" />
  <text x="540" y="275" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#FFFFFF">PORTLAND HOME GUIDE</text>
  <text x="540" y="330" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500" fill="#FFFFFF">Property photo unavailable</text>
</svg>`;

  return await sharp(Buffer.from(fallbackSvg))
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function fetchImageBuffer(
  imageUrl: string,
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    IMAGE_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PortlandHomeGuideCarousel/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`,
      );
    }

    const contentLength = Number(
      response.headers.get("content-length") || "0",
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_IMAGE_BYTES
    ) {
      throw new Error(
        `Image is larger than ${MAX_IMAGE_BYTES} bytes.`,
      );
    }

    if (!response.body) {
      return Buffer.from(
        await response.arrayBuffer(),
      );
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error(
          `Image exceeded ${MAX_IMAGE_BYTES} bytes while downloading.`,
        );
      }

      chunks.push(value);
    }

    return Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function renderCoverSvg(
  slide: Extract<PriceDropCarouselSlide, { layout: "cover" }>,
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
  logoDataUri: string,
): string {
  const { brand } = config;

  const highlight =
    slide.highlightValue && slide.highlightLabel
      ? `
      <rect x="72" y="865" width="936" height="250" rx="34" fill="#FFFFFF" fill-opacity="0.94" />
      <text x="118" y="958" class="highlightValue">${escapeXml(slide.highlightValue)}</text>
      ${renderWrappedText(
        slide.highlightLabel,
        118,
        1014,
        760,
        27,
        36,
        "highlightLabel",
        3,
      )}
      `
      : "";

  return svgShell(
    config,
    logoDataUri,
    slideNumber,
    totalSlides,
    `
    <defs>
      <linearGradient id="coverGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${escapeXml(brand.primary)}" />
        <stop offset="56%" stop-color="${escapeXml(brand.skyBlue)}" />
        <stop offset="100%" stop-color="${escapeXml(brand.accent)}" />
      </linearGradient>
    </defs>
    <rect x="0" y="138" width="1080" height="1212" fill="url(#coverGradient)" />
    <circle cx="1000" cy="275" r="270" fill="${escapeXml(brand.coral)}" fill-opacity="0.20" />
    <circle cx="100" cy="1120" r="290" fill="${escapeXml(brand.lavender)}" fill-opacity="0.23" />
    <text x="72" y="245" class="coverEyebrow">WEEKLY HOUSING WATCH</text>
    ${renderWrappedText(
      slide.title,
      72,
      335,
      900,
      82,
      88,
      "coverTitle",
      4,
    )}
    ${renderWrappedText(
      slide.subtitle,
      72,
      575,
      860,
      32,
      46,
      "coverSubtitle",
      4,
    )}
    <text x="72" y="765" class="dateLabel">${escapeXml(slide.dateLabel)}</text>
    ${highlight}
    <text x="72" y="1265" class="coverSite">PORTLANDHOMEGUIDE.COM</text>
    `,
    true,
  );
}

function renderPropertyOverlaySvg(
  slide: PriceDropCarouselPropertySlide,
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
  logoDataUri: string,
): string {
  const hasVerifiedReduction =
    slide.totalPriceReduction !== null &&
    slide.totalPriceReduction > 0 &&
    slide.originalPrice !== null &&
    slide.originalPrice > slide.currentPrice;

  const reductionValue =
    hasVerifiedReduction
      ? formatCompactCurrency(
          slide.totalPriceReduction!,
        )
      : "SEE DETAILS";

  const reductionLabel =
    hasVerifiedReduction
      ? "FROM ORIGINAL LIST"
      : "PRICE HISTORY";

  const originalPrice =
    hasVerifiedReduction &&
    slide.originalPrice !== null
      ? formatCurrency(slide.originalPrice)
      : "Not verified";

  const addressLines = wrapText(
    slide.address,
    936,
    39,
    2,
  );

  /*
   * Most addresses fit on one line. Pull the pricing cards upward in that
   * case so the property description gets more room. Long two-line addresses
   * retain additional clearance and cannot collide with the cards.
   */
  const priceCardsTop =
    addressLines.length <= 1
      ? 900
      : 947;

  const originalPriceY =
    priceCardsTop + 199;

  const factsTop =
    priceCardsTop + 219;

  const reasonY =
    priceCardsTop + 314;

  const reasonMaxLines =
    addressLines.length <= 1
      ? 3
      : 2;

  return svgShell(
    config,
    logoDataUri,
    slideNumber,
    totalSlides,
    `
    <rect x="0" y="700" width="1080" height="650" fill="${escapeXml(config.brand.background)}" />
    <rect x="72" y="725" width="936" height="76" rx="22" fill="${escapeXml(config.brand.primary)}" />
    <text x="104" y="775" class="propertyEyebrow">HOME ${slide.rank} OF 5</text>
    <text x="976" y="775" text-anchor="end" class="propertyEyebrow">PRICE DROP PICK</text>

    ${addressLines
      .map(
        (line, index) =>
          `<text x="72" y="${855 + index * 48}" class="address">${escapeXml(line)}</text>`,
      )
      .join("\n")}

    <rect x="72" y="${priceCardsTop}" width="447" height="156" rx="26" fill="#FFFFFF" />
    <text x="102" y="${priceCardsTop + 39}" class="smallLabel">CURRENT PRICE</text>
    <text x="102" y="${priceCardsTop + 108}" class="priceValue">${escapeXml(formatCurrency(slide.currentPrice))}</text>

    <rect x="537" y="${priceCardsTop}" width="471" height="156" rx="26" fill="#FFFFFF" />
    <text x="567" y="${priceCardsTop + 39}" class="smallLabel">PRICE DROP</text>
    <text x="567" y="${priceCardsTop + 104}" class="reductionValue">${escapeXml(reductionValue)}</text>
    <text x="567" y="${priceCardsTop + 136}" class="reductionDetail">${escapeXml(reductionLabel)}</text>

    <text x="72" y="${originalPriceY}" class="originalPrice">Original list: ${escapeXml(originalPrice)}</text>

    ${renderFactsRow(
      slide,
      config,
      factsTop,
    )}

    ${renderWrappedText(
      slide.shortReason,
      72,
      reasonY,
      850,
      23,
      31,
      "reason",
      reasonMaxLines,
    )}

    <text x="1008" y="1332" text-anchor="end" class="site">PORTLANDHOMEGUIDE.COM</text>
    `,
    false,
    false,
  );
}

function renderFactsRow(
  slide: PriceDropCarouselPropertySlide,
  config: InstagramAutomationConfig,
  top: number,
): string {
  const items = [
    {
      value:
        slide.bedrooms !== null
          ? String(slide.bedrooms)
          : "—",
      label: "BEDS",
    },
    {
      value: slide.bathrooms,
      label: "BATHS",
    },
    {
      value:
        slide.squareFeet !== null
          ? slide.squareFeet.toLocaleString("en-US")
          : "—",
      label: "SQ FT",
    },
    {
      value:
        slide.yearBuilt !== null
          ? String(slide.yearBuilt)
          : "—",
      label: "BUILT",
    },
  ];

  const startX = 72;
  const width = 186;
  const gap = 12;

  return items
    .map((item, index) => {
      const x = startX + index * (width + gap);
      return `
        <rect x="${x}" y="${top}" width="${width}" height="66" rx="18" fill="${escapeXml(config.brand.card)}" />
        <text x="${x + 20}" y="${top + 30}" class="factValue">${escapeXml(item.value)}</text>
        <text x="${x + 20}" y="${top + 54}" class="factLabel">${escapeXml(item.label)}</text>
      `;
    })
    .join("\n");
}

function renderCtaSvg(
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
  logoDataUri: string,
): string {
  const { brand } = config;

  return svgShell(
    config,
    logoDataUri,
    slideNumber,
    totalSlides,
    `
    <defs>
      <linearGradient id="ctaGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${escapeXml(brand.primary)}" />
        <stop offset="52%" stop-color="${escapeXml(brand.skyBlue)}" />
        <stop offset="100%" stop-color="${escapeXml(brand.accent)}" />
      </linearGradient>
    </defs>
    <rect x="0" y="138" width="1080" height="1212" fill="url(#ctaGradient)" />
    <circle cx="940" cy="315" r="310" fill="${escapeXml(brand.coral)}" fill-opacity="0.18" />
    <circle cx="150" cy="1130" r="330" fill="${escapeXml(brand.lavender)}" fill-opacity="0.20" />

    <text x="72" y="300" class="coverEyebrow">WANT THE DETAILS?</text>
    ${renderWrappedText(
      "INTERESTED IN\nONE OF THESE HOMES?",
      72,
      405,
      900,
      72,
      82,
      "coverTitle",
      4,
    )}

    ${renderWrappedText(
      "Get current listing details, photos, disclosures, showing availability and recent comparable sales.",
      72,
      640,
      860,
      34,
      47,
      "coverSubtitle",
      5,
    )}

    <rect x="72" y="925" width="936" height="195" rx="34" fill="#FFFFFF" fill-opacity="0.95" />
    <text x="540" y="1000" text-anchor="middle" class="ctaLabel">REACH OUT AT</text>
    <text x="540" y="1070" text-anchor="middle" class="ctaUrl">PortlandHomeGuide.com</text>

    <text x="72" y="1265" class="coverSite">LOCAL HOUSING RESEARCH FOR PORTLAND METRO</text>
    `,
    true,
  );
}

function svgShell(
  config: InstagramAutomationConfig,
  logoDataUri: string,
  slideNumber: number,
  totalSlides: number,
  content: string,
  lightText: boolean,
  drawBackground = true,
): string {
  const { brand } = config;
  const mainText = lightText
    ? "#FFFFFF"
    : brand.text;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${drawBackground ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="${escapeXml(brand.background)}" />` : ""}
  ${renderPaletteRail(config)}
  <image href="${escapeXml(logoDataUri)}" x="72" y="22" width="300" height="93" preserveAspectRatio="xMinYMid meet" />
  <text x="1008" y="90" text-anchor="end" class="counter">${slideNumber}/${totalSlides}</text>
  <line x1="72" y1="122" x2="1008" y2="122" stroke="${escapeXml(brand.divider)}" stroke-width="2" />
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: ${escapeXml(mainText)}; }
    .counter { font-size: 22px; font-weight: 800; fill: ${escapeXml(brand.muted)}; }
    .coverEyebrow { font-size: 25px; font-weight: 800; letter-spacing: 3px; fill: #FFFFFF; }
    .coverTitle { font-size: 82px; font-weight: 800; letter-spacing: -1.5px; fill: #FFFFFF; }
    .coverSubtitle { font-size: 32px; font-weight: 500; fill: #FFFFFF; }
    .dateLabel { font-size: 27px; font-weight: 800; fill: #FFFFFF; letter-spacing: 1px; }
    .highlightValue { font-size: 88px; font-weight: 800; fill: ${escapeXml(brand.primary)}; }
    .highlightLabel { font-size: 27px; font-weight: 800; fill: ${escapeXml(brand.text)}; }
    .coverSite { font-size: 22px; font-weight: 800; letter-spacing: 1.8px; fill: #FFFFFF; }
    .propertyEyebrow { font-size: 21px; font-weight: 800; letter-spacing: 1.7px; fill: #FFFFFF; }
    .address { font-size: 39px; font-weight: 800; fill: ${escapeXml(brand.text)}; }
    .smallLabel { font-size: 18px; font-weight: 800; letter-spacing: 1.5px; fill: ${escapeXml(brand.muted)}; }
    .priceValue { font-size: 48px; font-weight: 800; fill: ${escapeXml(brand.text)}; }
    .reductionValue { font-size: 48px; font-weight: 800; fill: ${escapeXml(brand.coral)}; }
    .reductionDetail { font-size: 15px; font-weight: 800; letter-spacing: 1.2px; fill: ${escapeXml(brand.muted)}; }
    .originalPrice { font-size: 20px; font-weight: 600; fill: ${escapeXml(brand.muted)}; }
    .factValue { font-size: 22px; font-weight: 800; fill: ${escapeXml(brand.text)}; }
    .factLabel { font-size: 13px; font-weight: 800; letter-spacing: 1.2px; fill: ${escapeXml(brand.muted)}; }
    .reason { font-size: 23px; font-weight: 500; fill: ${escapeXml(brand.muted)}; }
    .site { font-size: 19px; font-weight: 800; letter-spacing: 1.4px; fill: ${escapeXml(brand.primary)}; }
    .ctaLabel { font-size: 23px; font-weight: 800; letter-spacing: 2.2px; fill: ${escapeXml(brand.muted)}; }
    .ctaUrl { font-size: 47px; font-weight: 800; fill: ${escapeXml(brand.primary)}; }
  </style>
  ${content}
</svg>`;
}

function renderPaletteRail(
  config: InstagramAutomationConfig,
): string {
  const colors = [
    config.brand.accent,
    config.brand.primary,
    config.brand.lavender,
    config.brand.skyBlue,
    config.brand.coral,
  ];

  const segmentWidth = WIDTH / colors.length;

  return colors
    .map(
      (color, index) =>
        `<rect x="${index * segmentWidth}" y="0" width="${segmentWidth + 1}" height="14" fill="${escapeXml(color)}" />`,
    )
    .join("\n");
}

function renderWrappedText(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  className: string,
  maxLines: number,
): string {
  const lines = wrapText(
    text,
    maxWidth,
    fontSize,
    maxLines,
  );

  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
): string[] {
  const explicitLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const averageCharacterWidth = fontSize * 0.54;
  const maxCharacters = Math.max(
    8,
    Math.floor(maxWidth / averageCharacterWidth),
  );

  const lines: string[] = [];

  for (const explicitLine of explicitLines) {
    const words = explicitLine.split(/\s+/);
    let current = "";

    for (const word of words) {
      const candidate = current
        ? `${current} ${word}`
        : word;

      if (
        candidate.length <= maxCharacters ||
        !current
      ) {
        current = candidate;
        continue;
      }

      lines.push(current);
      current = word;

      if (lines.length >= maxLines) {
        break;
      }
    }

    if (
      current &&
      lines.length < maxLines
    ) {
      lines.push(current);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  const trimmed = lines.slice(0, maxLines);

  const consumed = trimmed.join(" ").length;
  const source = explicitLines.join(" ");

  if (
    trimmed.length === maxLines &&
    consumed < source.length - 2
  ) {
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1].replace(/[.,;:!?]+$/g, "")}…`;
  }

  return trimmed;
}

async function loadBrandLogoDataUri(
  configuredPath: string,
): Promise<string> {
  const logoPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(
        process.cwd(),
        configuredPath,
      );

  const logoBuffer = await fs.readFile(logoPath);

  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

function formatCurrency(
  value: number,
): string {
  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  );
}

function formatCompactCurrency(
  value: number,
): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions.toFixed(
      millions >= 10 ? 0 : 1,
    )}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }

  return `$${Math.round(value)}`;
}

function escapeXml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
