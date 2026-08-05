import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  "credentials.json",
);

export async function authorize() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  /*
   * Render and other hosted environments use saved OAuth credentials.
   */
  if (clientId && clientSecret && refreshToken) {
    console.log("Using environment-based Gmail authentication.");

    const auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
    );

    auth.setCredentials({
      refresh_token: refreshToken,
    });

    return auth;
  }

  /*
   * Local development uses Google's browser-based login.
   */
  console.log("Using local browser-based Gmail authentication.");

  return authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
}