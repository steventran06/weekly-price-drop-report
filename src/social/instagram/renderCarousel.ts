import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type {
  InstagramAutomationConfig,
} from "./config.js";

import type {
  InstagramCarouselDefinition,
  InstagramCarouselSlide,
  RenderedInstagramCarousel,
} from "./types.js";

const WIDTH = 1080;
const HEIGHT = 1350;

export async function renderInstagramCarousel(
  definition: InstagramCarouselDefinition,
  config: InstagramAutomationConfig,
): Promise<RenderedInstagramCarousel> {
  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
      "instagram",
      definition.slug,
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const svgPaths: string[] = [];
  const imagePaths: string[] = [];

  for (
    const [index, slide]
    of definition.slides.entries()
  ) {
    const svgFilename =
      slide.filename.replace(
        /\.jpe?g$/i,
        ".svg",
      );

    const svgPath =
      path.join(
        outputDirectory,
        svgFilename,
      );

    const imagePath =
      path.join(
        outputDirectory,
        slide.filename,
      );

    const svg =
      renderSlideSvg(
        slide,
        index + 1,
        definition.slides.length,
        config,
      );

    await fs.writeFile(
      svgPath,
      svg,
      "utf8",
    );

    svgPaths.push(
      svgPath,
    );

    await convertSvgToJpeg(
      svg,
      imagePath,
    );

    imagePaths.push(
      imagePath,
    );
  }

  const manifestPath =
    path.join(
      outputDirectory,
      "manifest.json",
    );

  const captionPath =
    path.join(
      outputDirectory,
      "caption.txt",
    );

  await Promise.all([
    fs.writeFile(
      captionPath,
      definition.caption + "\n",
      "utf8",
    ),

    fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          reportDate:
            definition.reportDate,
          slug:
            definition.slug,
          dimensions: {
            width:
              WIDTH,
            height:
              HEIGHT,
            aspectRatio:
              "4:5",
          },
          caption:
            definition.caption,
          images:
            imagePaths.map(
              (imagePath) =>
                path.basename(
                  imagePath,
                ),
            ),
          generatedAt:
            new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ),
  ]);

  return {
    outputDirectory,
    reportDate:
      definition.reportDate,
    slug:
      definition.slug,
    caption:
      definition.caption,
    svgPaths,
    imagePaths,
    manifestPath,
  };
}

function renderSlideSvg(
  slide: InstagramCarouselSlide,
  slideNumber: number,
  totalSlides: number,
  config: InstagramAutomationConfig,
): string {
  const {
    primary,
    background,
    accent,
    text,
    muted,
    lavender,
    skyBlue,
    coral,
    divider,
  } = config.brand;

  const commonHeader = `
    ${renderPaletteRail(config)}
    <text x="72" y="90" class="brand">PORTLAND HOME GUIDE</text>
    <text x="1008" y="90" text-anchor="end" class="counter">${slideNumber}/${totalSlides}</text>
    <line x1="72" y1="122" x2="1008" y2="122" stroke="${escapeXml(divider)}" stroke-width="2" />
  `;

  const commonFooter = `
    <line x1="72" y1="1200" x2="1008" y2="1200" stroke="${escapeXml(divider)}" stroke-width="2" />
    ${renderWrappedText(
      slide.footer || "portlandhomeguide.com",
      72,
      1240,
      680,
      22,
      32,
      "footer",
    )}
    <text x="1008" y="1262" text-anchor="end" class="site">PORTLANDHOMEGUIDE.COM</text>
  `;

  const content =
    renderSlideContent(
      slide,
      config,
    );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="heroGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(primary)}" />
      <stop offset="100%" stop-color="${escapeXml(skyBlue)}" />
    </linearGradient>
    <linearGradient id="softGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(accent)}" stop-opacity="0.18" />
      <stop offset="100%" stop-color="${escapeXml(lavender)}" stop-opacity="0.32" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${escapeXml(background)}" />
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: ${escapeXml(text)}; }
    .brand { font-size: 28px; font-weight: 800; letter-spacing: 3.2px; fill: ${escapeXml(primary)}; }
    .counter { font-size: 22px; font-weight: 800; fill: ${escapeXml(muted)}; }
    .eyebrow { font-size: 24px; font-weight: 800; letter-spacing: 3px; fill: ${escapeXml(primary)}; }
    .title { font-size: 68px; font-weight: 800; letter-spacing: -1.2px; }
    .subtitle { font-size: 29px; font-weight: 400; fill: ${escapeXml(muted)}; }
    .stat { font-size: 106px; font-weight: 800; }
    .statLabel { font-size: 26px; font-weight: 800; letter-spacing: 0.8px; }
    .detail { font-size: 24px; font-weight: 400; fill: ${escapeXml(muted)}; }
    .rowRank { font-size: 31px; font-weight: 800; fill: #FFFFFF; }
    .rowArea { font-size: 33px; font-weight: 800; }
    .rowPrimary { font-size: 27px; font-weight: 800; fill: ${escapeXml(primary)}; }
    .rowSecondary { font-size: 22px; font-weight: 400; fill: ${escapeXml(muted)}; }
    .body { font-size: 39px; font-weight: 500; }
    .footer { font-size: 21px; font-weight: 400; fill: ${escapeXml(muted)}; }
    .site { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; fill: ${escapeXml(primary)}; }
  </style>
  ${commonHeader}
  ${content}
  ${commonFooter}
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

function renderSlideContent(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  switch (
    slide.layout
  ) {
    case "cover":
      return renderCover(
        slide,
        config,
      );

    case "metro":
      return renderMetro(
        slide,
        config,
      );

    case "ranking":
      return renderRanking(
        slide,
        config,
      );

    case "comparison":
      return renderComparison(
        slide,
        config,
      );

    case "insights":
      return renderInsights(
        slide,
        config,
      );

    case "takeaway":
      return renderTakeaway(
        slide,
        config,
      );
  }
}

function renderCover(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  const {
    primary,
    accent,
    lavender,
    skyBlue,
    coral,
  } = config.brand;

  return `
    <rect x="72" y="190" width="104" height="10" rx="5" fill="${escapeXml(coral)}" />
    <rect x="184" y="190" width="70" height="10" rx="5" fill="${escapeXml(accent)}" />
    ${renderWrappedText(slide.eyebrow, 72, 252, 900, 24, 34, "eyebrow")}
    ${renderWrappedText(slide.title, 72, 365, 900, 68, 80, "title")}
    ${renderWrappedText(slide.subtitle || "", 72, 620, 840, 29, 40, "subtitle")}

    <rect x="72" y="730" width="936" height="300" rx="34" fill="url(#heroGradient)" />
    <circle cx="900" cy="790" r="118" fill="${escapeXml(accent)}" opacity="0.92" />
    <circle cx="960" cy="890" r="92" fill="${escapeXml(lavender)}" opacity="0.92" />
    <circle cx="838" cy="957" r="68" fill="${escapeXml(coral)}" opacity="0.94" />
    <path d="M790 760 C845 810 828 885 906 930" fill="none" stroke="${escapeXml(skyBlue)}" stroke-width="22" stroke-linecap="round" opacity="0.92" />
    <path d="M796 820 C850 870 858 932 920 978" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.78" />

    <text x="118" y="815" style="font-size:27px;font-weight:800;letter-spacing:2px;fill:#FFFFFF">WEEKLY LOCAL DATA</text>
    <text x="118" y="900" style="font-size:50px;font-weight:800;fill:#FFFFFF">Clear numbers.</text>
    <text x="118" y="963" style="font-size:50px;font-weight:800;fill:#FFFFFF">Local context.</text>
    <rect x="118" y="986" width="204" height="8" rx="4" fill="${escapeXml(primary)}" opacity="0" />
  `;
}

function renderMetro(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  return `
    ${renderSectionHeading(slide)}
    ${renderStatCard(slide.statLeft, 72, 510, 440, 480, config, config.brand.accent)}
    ${renderStatCard(slide.statRight, 568, 510, 440, 480, config, config.brand.coral)}
  `;
}

function renderComparison(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  return `
    ${renderSectionHeading(slide)}
    ${renderStatCard(slide.statLeft, 72, 540, 440, 455, config, config.brand.accent)}
    ${renderStatCard(slide.statRight, 568, 540, 440, 455, config, config.brand.coral)}
    <circle cx="540" cy="785" r="36" fill="${escapeXml(config.brand.background)}" stroke="${escapeXml(config.brand.divider)}" stroke-width="2" />
    <text x="540" y="795" text-anchor="middle" style="font-size:24px;font-weight:800;fill:${escapeXml(config.brand.primary)}">VS</text>
  `;
}

function renderRanking(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  const rows =
    slide.rows || [];

  const rowColors = [
    config.brand.accent,
    config.brand.skyBlue,
    config.brand.coral,
  ];

  const rowMarkup =
    rows.map(
      (row, index) => {
        // Ranking slides can have a two-line subtitle. Keep the first
        // card below the full heading block so wrapped copy is never
        // hidden behind the card. The tighter row spacing still leaves
        // comfortable room above the shared footer.
        const y =
          610 +
          index * 180;

        const rowColor =
          rowColors[index % rowColors.length];

        const areaLines =
          wrapText(
            row.area,
            38,
          ).slice(
            0,
            2,
          );

        return `
          <rect x="72" y="${y - 72}" width="936" height="158" rx="26" fill="${escapeXml(config.brand.card)}" stroke="${escapeXml(config.brand.divider)}" stroke-width="2" />
          <rect x="72" y="${y - 72}" width="10" height="158" rx="5" fill="${escapeXml(rowColor)}" />
          <circle cx="134" cy="${y}" r="39" fill="${escapeXml(rowColor)}" />
          <text x="134" y="${y + 11}" text-anchor="middle" class="rowRank">${row.rank}</text>
          ${renderLines(areaLines, 198, y - 12, 33, 39, "rowArea")}
          <text x="198" y="${y + 50}" class="rowPrimary">${escapeXml(row.primary)}</text>
          <text x="986" y="${y + 50}" text-anchor="end" class="rowSecondary">${escapeXml(row.secondary)}</text>
        `;
      },
    )
    .join("\n");

  return `
    ${renderSectionHeading(slide)}
    ${rowMarkup}
  `;
}


function renderInsights(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  const insights =
    (slide.insights || []).slice(0, 3);

  const cardColors = [
    config.brand.accent,
    config.brand.skyBlue,
    config.brand.coral,
  ];

  const cards =
    insights
      .map(
        (insight, index) => {
          const y =
            540 +
            index * 195;

          const accent =
            cardColors[index % cardColors.length];

          return `
            <rect x="72" y="${y}" width="936" height="180" rx="26" fill="${escapeXml(config.brand.card)}" stroke="${escapeXml(config.brand.divider)}" stroke-width="2" />
            <rect x="72" y="${y}" width="12" height="180" rx="6" fill="${escapeXml(accent)}" />
            <circle cx="126" cy="${y + 48}" r="24" fill="${escapeXml(accent)}" />
            <text x="126" y="${y + 57}" text-anchor="middle" style="font-size:24px;font-weight:800;fill:#FFFFFF">${index + 1}</text>
            ${renderWrappedText(insight.title, 172, y + 48, 790, 29, 34, "rowArea")}
            ${renderWrappedText(insight.body, 172, y + 108, 790, 22, 29, "rowSecondary")}
          `;
        },
      )
      .join("\n");

  return `
    ${renderSectionHeading(slide)}
    ${cards}
  `;
}

function renderTakeaway(
  slide: InstagramCarouselSlide,
  config: InstagramAutomationConfig,
): string {
  return `
    ${renderSectionHeading(slide)}
    <rect x="72" y="520" width="936" height="490" rx="32" fill="url(#heroGradient)" />
    <rect x="72" y="520" width="13" height="490" rx="6" fill="${escapeXml(config.brand.coral)}" />
    <circle cx="930" cy="575" r="82" fill="${escapeXml(config.brand.accent)}" opacity="0.36" />
    <circle cx="972" cy="650" r="56" fill="${escapeXml(config.brand.lavender)}" opacity="0.42" />
    ${renderWrappedTextWithFill(slide.body || "", 118, 620, 790, 34, 48, "body", "#FFFFFF")}
  `;
}

function renderSectionHeading(
  slide: InstagramCarouselSlide,
): string {
  return `
    ${renderWrappedText(slide.eyebrow, 72, 218, 900, 24, 34, "eyebrow")}
    ${renderWrappedText(slide.title, 72, 308, 900, 60, 70, "title")}
    ${renderWrappedText(slide.subtitle || "", 72, 455, 900, 28, 38, "subtitle")}
  `;
}

function renderStatCard(
  stat:
    | InstagramCarouselSlide["statLeft"]
    | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  config: InstagramAutomationConfig,
  cardAccent: string,
): string {
  if (!stat) {
    return "";
  }

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="${escapeXml(config.brand.card)}" stroke="${escapeXml(config.brand.divider)}" stroke-width="2" />
    <rect x="${x}" y="${y}" width="${width}" height="14" rx="7" fill="${escapeXml(cardAccent)}" />
    <rect x="${x + 36}" y="${y + 44}" width="76" height="8" rx="4" fill="${escapeXml(cardAccent)}" opacity="0.9" />
    <text x="${x + 36}" y="${y + 150}" class="stat" style="fill:${escapeXml(cardAccent)}">${escapeXml(stat.value)}</text>
    ${renderWrappedText(stat.label, x + 36, y + 215, width - 72, 26, 34, "statLabel")}
    ${renderWrappedText(stat.detail || "", x + 36, y + height - 96, width - 72, 24, 32, "detail")}
  `;
}

function renderWrappedText(
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  className: string,
): string {
  return renderWrappedTextWithFill(
    value,
    x,
    y,
    maxWidth,
    fontSize,
    lineHeight,
    className,
    null,
  );
}

function renderWrappedTextWithFill(
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  className: string,
  fill: string | null,
): string {
  if (!value) {
    return "";
  }

  const explicitLines =
    value.split("\n");

  const maxChars =
    Math.max(
      8,
      Math.floor(
        maxWidth /
          (fontSize * 0.56),
      ),
    );

  const lines =
    explicitLines.flatMap(
      (line) =>
        wrapText(
          line,
          maxChars,
        ),
    );

  return renderLines(
    lines,
    x,
    y,
    fontSize,
    lineHeight,
    className,
    fill,
  );
}

function renderLines(
  lines: string[],
  x: number,
  y: number,
  _fontSize: number,
  lineHeight: number,
  className: string,
  fill: string | null = null,
): string {
  const fillStyle =
    fill
      ? ` style="fill:${escapeXml(fill)}"`
      : "";

  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}"${fillStyle}>${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function wrapText(
  value: string,
  maxChars: number,
): string[] {
  const normalized =
    value
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (!normalized) {
    return [];
  }

  const words =
    normalized.split(" ");

  const lines: string[] = [];

  let current =
    "";

  for (
    const word
    of words
  ) {
    const next =
      current
        ? `${current} ${word}`
        : word;

    if (
      next.length <= maxChars ||
      !current
    ) {
      current = next;
      continue;
    }

    lines.push(
      current,
    );
    current = word;
  }

  if (current) {
    lines.push(
      current,
    );
  }

  return lines;
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

async function convertSvgToJpeg(
  svg: string,
  imagePath: string,
): Promise<void> {
  await sharp(
    Buffer.from(svg),
    {
      density: 144,
    },
  )
    .resize(
      WIDTH,
      HEIGHT,
      {
        fit: "fill",
      },
    )
    .flatten({
      background: "#ffffff",
    })
    .jpeg({
      quality: 92,
      chromaSubsampling: "4:4:4",
    })
    .toFile(imagePath);
}
