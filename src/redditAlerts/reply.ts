import type {
  RedditPost,
  RelevanceResult,
} from "./types.js";

export function buildSuggestedReply(
  post: RedditPost,
  relevance: RelevanceResult,
): string {
  const primaryCity = relevance.cities[0];

  if (!primaryCity) {
    return "";
  }

  const text = `${post.title}\n${post.body}`;
  const priorityAdvice = buildPriorityAdvice(text);
  const otherMatchedCities =
    relevance.cities
      .slice(1, 3)
      .map((city) => city.name);

  const nearby = primaryCity.nearby
    .slice(0, 2)
    .join(" and ");

  const paragraphs = [
    `Portland-area local here. ${primaryCity.insight}`,
  ];

  if (priorityAdvice) {
    paragraphs.push(priorityAdvice);
  }

  if (otherMatchedCities.length > 0) {
    const comparisonCities =
      formatList([
        primaryCity.name,
        ...otherMatchedCities,
      ]);

    paragraphs.push(
      `Since you’re already comparing ${comparisonCities}, I’d look at the full monthly cost, commute, housing age/type and how urban versus suburban you want the day-to-day experience to feel.`,
    );
  } else if (nearby) {
    paragraphs.push(
      `If ${primaryCity.name} is on your list, I’d also compare ${nearby} so you can see how the housing, commute and day-to-day feel change across the metro.`,
    );
  }

  paragraphs.push(
    "If you share your budget, where you’ll be working, the type of home you want and your biggest priorities, I’m happy to narrow it down further.",
  );

  paragraphs.push(
    "I’m also a local Realtor and work with a lot of relocation buyers around Portland Metro and Southwest Washington, but happy to just be a resource and answer questions here.",
  );

  return paragraphs.join("\n\n");
}

function formatList(
  values: string[],
): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return (
    values
      .slice(0, -1)
      .join(", ") +
    ` and ${values.at(-1)}`
  );
}

function buildPriorityAdvice(
  text: string,
): string | null {
  const advice: string[] = [];

  if (
    /\b(commute|work|job|office|drive to work|traffic)\b/i.test(text)
  ) {
    advice.push(
      "For a relocation search, I’d start with the exact work location and test the commute at the hours you’ll actually travel. In this metro, crossing the river or relying on Highway 26, 217, I-5 or I-205 can materially change which area makes sense.",
    );
  }

  if (
    /\b(walkable|walkability|transit|light rail|max|car[- ]free|public transportation)\b/i.test(text)
  ) {
    advice.push(
      "Walkability and transit vary much more neighborhood by neighborhood than city by city here, so I’d compare the specific address rather than relying only on the city name.",
    );
  }

  if (
    /\b(new construction|new build|newer home|new home)\b/i.test(text)
  ) {
    advice.push(
      "If newer construction matters, the outer west side, south metro and several Southwest Washington cities generally give you more options than the close-in Portland neighborhoods.",
    );
  }

  if (
    /\b(hik(?:e|ing)|outdoor|mountain|water|river|trail|nature|ski|skiing)\b/i.test(text)
  ) {
    advice.push(
      "Outdoor access is strong across the region, but the side of the metro matters: east-side locations make the Gorge easier, north/WA locations change access toward Mount St. Helens, and west-side locations are convenient for the Coast Range and west-side trail systems.",
    );
  }

  if (
    /\b(school|school district|kids|children|child)\b/i.test(text)
  ) {
    advice.push(
      "If school assignment matters to your search, verify the exact district and boundary for each address rather than assuming it from the city or mailing address.",
    );
  }

  if (
    /\b(budget|afford|price|payment|monthly|under \$|\$\d)\b/i.test(text)
  ) {
    advice.push(
      "I’d compare the full monthly cost rather than list price alone—mortgage rate, property taxes, HOA dues and insurance can shift the real affordability quite a bit between Oregon and Southwest Washington.",
    );
  }

  if (
    /\b(investment property|real estate invest|rental property|investor)\b/i.test(text)
  ) {
    advice.push(
      "If this is an investment purchase, I’d underwrite the specific property rather than rely on metro-wide averages—rent assumptions, HOA or rental restrictions, taxes, insurance and deferred maintenance can change the numbers quickly.",
    );
  }

  if (
    /\b(yard|lot|acre|garage|space|workshop)\b/i.test(text)
  ) {
    advice.push(
      "If lot size, garage space or a larger yard is important, it’s usually worth widening the search beyond the close-in neighborhoods because the housing stock changes quickly as you move outward.",
    );
  }

  return advice[0] ?? null;
}
