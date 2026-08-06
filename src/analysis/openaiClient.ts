import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5-mini";

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to the root .env file.",
    );
  }

  return new OpenAI({
    apiKey,
  });
}

export function getOpenAIModel(): string {
  return (
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}