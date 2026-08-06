export function parseOpenAIJson<T>(
  output: string,
  responseName: string,
): T {
  const cleaned = output
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    throw new Error(
      `OpenAI returned an empty ${responseName} response.`,
    );
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `OpenAI returned invalid ${responseName} JSON:\n${output}`,
    );
  }
}