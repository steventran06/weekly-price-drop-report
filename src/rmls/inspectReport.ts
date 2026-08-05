import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

interface InspectionResult {
  title: string;
  tables: number;
  images: number;
  links: number;
  possibleListingBlocks: number;
  sampleText: string[];
  sampleLinks: Array<{
    text: string;
    href: string;
  }>;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function inspectSavedRmlsReport(): Promise<InspectionResult> {
  const reportPath = path.join(
    process.cwd(),
    "output",
    "rmls-report.html",
  );

  const html = await fs.readFile(reportPath, "utf8");
  const $ = cheerio.load(html);

  const sampleText: string[] = [];

  $("body *").each((_, element) => {
    if (sampleText.length >= 60) {
      return false;
    }

    const node = $(element);

    if (node.children().length > 0) {
      return;
    }

    const text = cleanText(node.text());

    if (
      text.length >= 3 &&
      text.length <= 250 &&
      !sampleText.includes(text)
    ) {
      sampleText.push(text);
    }
  });

  const sampleLinks = $("a[href]")
    .slice(0, 40)
    .map((_, element) => {
      const node = $(element);

      return {
        text: cleanText(node.text()),
        href: node.attr("href") ?? "",
      };
    })
    .get();

  const possibleListingBlocks = [
    "[class*='listing']",
    "[id*='listing']",
    "[class*='property']",
    "[id*='property']",
    "table",
  ].reduce((total, selector) => total + $(selector).length, 0);

  return {
    title: cleanText($("title").first().text()),
    tables: $("table").length,
    images: $("img").length,
    links: $("a[href]").length,
    possibleListingBlocks,
    sampleText,
    sampleLinks,
  };
}