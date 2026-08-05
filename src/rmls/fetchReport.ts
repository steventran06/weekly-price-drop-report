import fs from "node:fs/promises";
import path from "node:path";

export interface FetchReportResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
}

export async function fetchRmlsReport(
  url: string,
): Promise<FetchReportResult> {
  console.log("Downloading RMLS report...");

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(
      `RMLS request failed with status ${response.status}.`,
    );
  }

  return {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    html,
  };
}

export async function saveRawReportHtml(
  html: string,
): Promise<string> {
  const outputDirectory = path.join(process.cwd(), "output");
  const outputPath = path.join(outputDirectory, "rmls-report.html");

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  await fs.writeFile(outputPath, html, "utf8");

  return outputPath;
}