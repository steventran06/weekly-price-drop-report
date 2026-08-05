import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  "credentials.json",
);

interface InstalledCredentials {
  installed?: {
    client_id?: string;
    client_secret?: string;
  };
}

async function main(): Promise<void> {
  console.log("Authorizing Gmail for unattended use...");

  const credentialsFile = JSON.parse(
    await fs.readFile(CREDENTIALS_PATH, "utf8"),
  ) as InstalledCredentials;

  const clientId = credentialsFile.installed?.client_id;
  const clientSecret =
    credentialsFile.installed?.client_secret;

  if (!clientId || !clientSecret) {
    throw new Error(
      "credentials.json is missing installed.client_id or installed.client_secret.",
    );
  }

  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  const refreshToken = auth.credentials.refresh_token;

  if (!refreshToken) {
    throw new Error(
      [
        "Google did not return a refresh token.",
        "Remove the app from your Google account's authorized connections,",
        "then run this command again and approve access.",
      ].join(" "),
    );
  }

  console.log("");
  console.log("Add these values to Render:");
  console.log("--------------------------------");
  console.log(`GOOGLE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
  console.log("--------------------------------");
  console.log("");
  console.log(
    "Treat these values as secrets. Do not commit or share them.",
  );
}

main().catch((error: unknown) => {
  console.error("Authentication export failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});