export type CityProfile = {
  name: string;
  state: "OR" | "WA";
  aliases: string[];
  strictAliases?: string[];
  nearby: string[];
  insight: string;
};

export const CITY_PROFILES: CityProfile[] = [
  {
    name: "Portland",
    state: "OR",
    aliases: ["portland", "pdx", "portland metro", "portland area"],
    nearby: ["Beaverton", "Milwaukie", "Vancouver"],
    insight:
      "Portland is really a collection of smaller housing markets: inner neighborhoods tend to be older and more walkable, while Southwest and outer areas can feel more suburban and offer different lot sizes and commute patterns.",
  },
  {
    name: "Beaverton",
    state: "OR",
    aliases: ["beaverton"],
    nearby: ["Hillsboro", "Tigard", "Portland"],
    insight:
      "Beaverton has a wide mix of established neighborhoods, townhomes and newer communities, with strong west-side access. The city boundary versus a Beaverton mailing address is worth checking because jurisdiction and neighborhood feel can differ.",
  },
  {
    name: "Hillsboro",
    state: "OR",
    aliases: ["hillsboro"],
    nearby: ["Beaverton", "North Plains", "Forest Grove"],
    insight:
      "Hillsboro mixes an older core with newer west-side development and tends to work well for buyers who want access to west-side employment, MAX service and a broad range of newer and established housing.",
  },
  {
    name: "Tigard",
    state: "OR",
    aliases: ["tigard"],
    nearby: ["Tualatin", "Beaverton", "Sherwood"],
    insight:
      "Tigard is a suburban west/southwest option with a mix of established homes and newer development. Highway 217, I-5 and surface-street commute patterns can matter a lot depending on where you work.",
  },
  {
    name: "Tualatin",
    state: "OR",
    aliases: ["tualatin"],
    nearby: ["Tigard", "Wilsonville", "Sherwood"],
    insight:
      "Tualatin has an established suburban feel with good access to I-5 and I-205, plus a mix of detached homes, townhomes and newer pockets. Commute direction is one of the biggest things I would compare.",
  },
  {
    name: "Sherwood",
    state: "OR",
    aliases: ["sherwood"],
    nearby: ["Tigard", "Tualatin", "Wilsonville"],
    insight:
      "Sherwood has a smaller-city suburban feel with a lot of newer housing mixed with established neighborhoods. Highway 99W is the main commute consideration for buyers heading toward Portland or the west side.",
  },
  {
    name: "Wilsonville",
    state: "OR",
    aliases: ["wilsonville"],
    nearby: ["Tualatin", "Sherwood", "Oregon City"],
    insight:
      "Wilsonville is centered around I-5 and has a lot of planned neighborhoods and newer housing. It can make sense for buyers whose work or family ties pull them both north toward Portland and south toward the Willamette Valley.",
  },
  {
    name: "Lake Oswego",
    state: "OR",
    aliases: ["lake oswego"],
    nearby: ["West Linn", "Tigard", "Portland"],
    insight:
      "Lake Oswego has a broad range of housing from older established neighborhoods to remodeled and newer homes. Topography, HOA structure, lake-access rights and commute route can change the buyer experience substantially from one area to another.",
  },
  {
    name: "West Linn",
    state: "OR",
    aliases: ["west linn"],
    nearby: ["Lake Oswego", "Oregon City", "Tualatin"],
    insight:
      "West Linn is hilly and largely residential, with established neighborhoods and newer pockets. I-205 access, topography and the specific side of town can make a meaningful difference in commute and day-to-day convenience.",
  },
  {
    name: "Milwaukie",
    state: "OR",
    aliases: ["milwaukie"],
    nearby: ["Portland", "Happy Valley", "Oregon City"],
    insight:
      "Milwaukie is a close-in southeast option with a lot of older housing, access to the MAX Orange Line and relatively easy connections to Portland and Clackamas County. Housing condition can vary quite a bit block to block.",
  },
  {
    name: "Oregon City",
    state: "OR",
    aliases: ["oregon city"],
    nearby: ["West Linn", "Happy Valley", "Milwaukie"],
    insight:
      "Oregon City combines a historic core with larger newer suburban areas. Hills, I-205 access and the difference between older close-in housing and newer subdivisions are useful things to compare during a search.",
  },
  {
    name: "Happy Valley",
    state: "OR",
    aliases: ["happy valley"],
    nearby: ["Milwaukie", "Gresham", "Oregon City"],
    insight:
      "Happy Valley has seen a lot of newer residential development and is generally more car-oriented. Topography, HOA structure and the route toward I-205 or Portland are worth evaluating address by address.",
  },
  {
    name: "Gresham",
    state: "OR",
    aliases: ["gresham"],
    nearby: ["Troutdale", "Happy Valley", "Portland"],
    insight:
      "Gresham offers a wide range of housing on the east side, including established neighborhoods and newer pockets, with MAX access in parts of the city and easier access toward the Columbia River Gorge.",
  },
  {
    name: "Troutdale",
    state: "OR",
    aliases: ["troutdale"],
    nearby: ["Gresham", "Portland"],
    insight:
      "Troutdale is a smaller east-metro city with direct I-84 access and quick access to the Gorge. Buyers should weigh the smaller local housing inventory against the commute and outdoor-access advantages.",
  },
  {
    name: "Forest Grove",
    state: "OR",
    aliases: ["forest grove"],
    nearby: ["Cornelius", "Hillsboro", "North Plains"],
    insight:
      "Forest Grove has a smaller-city core with older homes plus newer development around the edges. The tradeoff is usually more distance from central Portland in exchange for a different pace and housing mix.",
  },
  {
    name: "Cornelius",
    state: "OR",
    aliases: ["cornelius"],
    nearby: ["Forest Grove", "Hillsboro"],
    insight:
      "Cornelius sits between Hillsboro and Forest Grove and has a mix of established housing and newer growth. For west-side buyers, commute time and access to Hillsboro services are usually part of the comparison.",
  },
  {
    name: "North Plains",
    state: "OR",
    aliases: ["north plains"],
    nearby: ["Hillsboro", "Forest Grove"],
    insight:
      "North Plains is a smaller community north of Hillsboro with substantial newer growth and convenient Highway 26 access. It can appeal to buyers who want newer housing while staying connected to the west side.",
  },
  {
    name: "Vancouver",
    state: "WA",
    aliases: ["vancouver"],
    strictAliases: [
      "vancouver wa",
      "vancouver, wa",
      "vancouver washington",
      "vancouver, washington",
      "clark county",
      "southwest washington",
      "sw washington",
    ],
    nearby: ["Camas", "Ridgefield", "Portland"],
    insight:
      "Vancouver varies a lot from Downtown and the Waterfront to central and east-side suburban neighborhoods. If you expect to work in Oregon, I would make the I-5/I-205 bridge commute part of the housing decision from the beginning.",
  },
  {
    name: "Camas",
    state: "WA",
    aliases: ["camas"],
    strictAliases: ["camas wa", "camas, wa", "camas washington"],
    nearby: ["Washougal", "Vancouver"],
    insight:
      "Camas combines an older downtown with newer hillside and suburban development. SR-14 access, topography and whether you need to commute toward Vancouver or Portland are important practical differences between neighborhoods.",
  },
  {
    name: "Washougal",
    state: "WA",
    aliases: ["washougal"],
    nearby: ["Camas", "Vancouver"],
    insight:
      "Washougal sits east of Camas with strong river and Gorge access and a smaller-city feel. The main buyer tradeoff is usually more distance from Vancouver/Portland in exchange for that location and housing environment.",
  },
  {
    name: "Ridgefield",
    state: "WA",
    aliases: ["ridgefield"],
    strictAliases: ["ridgefield wa", "ridgefield, wa", "ridgefield washington"],
    nearby: ["Vancouver", "Battle Ground", "La Center"],
    insight:
      "Ridgefield has grown quickly, so the housing stock is increasingly newer. I would compare the older downtown/west side with the newer east-side subdivisions and pay close attention to I-5 commute time and ongoing growth around the city.",
  },
  {
    name: "Battle Ground",
    state: "WA",
    aliases: ["battle ground"],
    strictAliases: ["battle ground wa", "battle ground, wa", "battle ground washington"],
    nearby: ["Vancouver", "Ridgefield"],
    insight:
      "Battle Ground offers a more suburban-to-rural mix north of Vancouver and can provide more space depending on the property. The tradeoff is a longer commute toward Vancouver or Portland, so I would test that drive at your actual work hours.",
  },
  {
    name: "La Center",
    state: "WA",
    aliases: ["la center"],
    strictAliases: ["la center wa", "la center, wa", "la center washington"],
    nearby: ["Ridgefield", "Battle Ground"],
    insight:
      "La Center is a small north Clark County market with newer growth and access to I-5 through the nearby junction. Housing choice is narrower than Vancouver or Ridgefield, so commute and inventory are usually the key tradeoffs.",
  },
];

export const CITY_NAMES = CITY_PROFILES.map(
  (city) => city.name,
);

export function buildCitySearchTerms(
  state?: "OR" | "WA",
): string[] {
  return CITY_PROFILES
    .filter(
      (city) => !state || city.state === state,
    )
    .map((city) =>
      city.name.includes(" ")
        ? `"${city.name}"`
        : city.name,
    );
}

export function findCityMatches(
  rawText: string,
  subreddit?: string | null,
): CityProfile[] {
  const text = normalize(rawText);
  const subredditName = normalize(subreddit ?? "");

  const matches = CITY_PROFILES.filter((city) => {
    if (isCityImpliedBySubreddit(city, subredditName)) {
      return true;
    }

    if (
      city.name === "Portland" &&
      /\b(portland\s*,?\s*maine|portland\s+me|maine)\b/i.test(rawText) &&
      !/\b(oregon|pdx|pnw|portland\s*,?\s*or)\b/i.test(rawText)
    ) {
      return false;
    }

    if (
      city.name === "Vancouver" &&
      /\b(bc|british columbia|canada)\b/i.test(rawText) &&
      !/\b(wa|washington|clark county|portland)\b/i.test(rawText)
    ) {
      return false;
    }

    const aliases = city.aliases.map(normalize);

    if (!aliases.some((alias) => hasPhrase(text, alias))) {
      return false;
    }

    if (!city.strictAliases?.length) {
      return true;
    }

    const strictAliases = city.strictAliases.map(normalize);

    if (strictAliases.some((alias) => hasPhrase(text, alias))) {
      return true;
    }

    if (city.state === "OR") {
      return /\b(oregon|pnw|portland metro|portland area)\b/i.test(rawText);
    }

    return /\b(washington|wa|clark county|southwest washington|sw washington|portland metro|pnw)\b/i.test(
      rawText,
    );
  });

  return matches.sort((a, b) => {
    const aImplied = isCityImpliedBySubreddit(a, subredditName);
    const bImplied = isCityImpliedBySubreddit(b, subredditName);

    if (aImplied !== bImplied) {
      return aImplied ? -1 : 1;
    }

    return firstAliasIndex(text, a) - firstAliasIndex(text, b);
  });
}

function firstAliasIndex(
  text: string,
  city: CityProfile,
): number {
  const indexes = city.aliases
    .map(normalize)
    .map((alias) => text.indexOf(alias))
    .filter((index) => index >= 0);

  return indexes.length > 0
    ? Math.min(...indexes)
    : Number.MAX_SAFE_INTEGER;
}

function isCityImpliedBySubreddit(
  city: CityProfile,
  subreddit: string,
): boolean {
  const map: Record<string, string> = {
    portland: "Portland",
    portlandor: "Portland",
    askportland: "Portland",
    beaverton: "Beaverton",
    hillsboro: "Hillsboro",
    hillsboroor: "Hillsboro",
    tigard: "Tigard",
    vancouverwa: "Vancouver",
    camaswashington: "Camas",
    ridgefield: "Ridgefield",
  };

  return map[subreddit] === city.name;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$%+.,'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(
  text: string,
  phrase: string,
): boolean {
  const escaped = phrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return new RegExp(
    `(^|\\b)${escaped}(\\b|$)`,
    "i",
  ).test(text);
}
