import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  "credentials.json",
);

export async function authorize() {
  return authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
}