import type {
  NewConstructionBuilder,
  NewConstructionData,
} from "./types.js";

/**
 * Builders Steven wants the twice-monthly official-site research workflow to track.
 *
 * Existing website records always win. This registry only adds a builder when its
 * id/domain is not already present, so manual edits made in data/new-construction.json
 * are preserved on later runs.
 */
const TRACKED_BUILDERS: NewConstructionBuilder[] = [
  {
    id: "lennar",
    name: "Lennar",
    domain: "lennar.com",
    website: "https://www.lennar.com/new-homes/oregon/portland",
    sourceUrl: "https://www.lennar.com/new-homes/oregon/portland",
    summary:
      "National homebuilder with new-home communities and move-in-ready inventory across major markets, including the Portland area when currently offered.",
  },
  {
    id: "risewell-homes",
    name: "Risewell Homes",
    domain: "risewellhomes.com",
    website: "https://risewellhomes.com/finder/oregon",
    sourceUrl: "https://risewellhomes.com/finder/oregon",
    summary:
      "Homebuilder active in Oregon and Washington with neighborhood, floor-plan and available-home information published through its regional home finder.",
  },
  {
    id: "taylor-morrison",
    name: "Taylor Morrison",
    domain: "taylormorrison.com",
    website: "https://www.taylormorrison.com/or",
    sourceUrl: "https://www.taylormorrison.com/or",
    summary:
      "National builder with Portland Metro and Southwest Washington communities, including detached homes and townhomes with current pricing and availability information.",
  },
  {
    id: "dr-horton",
    name: "D.R. Horton",
    domain: "drhorton.com",
    website: "https://www.drhorton.com/oregon/greater-portland",
    sourceUrl: "https://www.drhorton.com/oregon/greater-portland",
    summary:
      "Large national builder with Greater Portland communities, quick-move-in inventory and multiple home series across a range of price points.",
  },
  {
    id: "riverside-homes",
    name: "Riverside Homes",
    domain: "riversidehome.com",
    website: "http://riversidehome.com/",
    sourceUrl: "http://riversidehome.com/",
    summary:
      "Portland-area homebuilder historically active in Beaverton, Hillsboro, Tigard, Sherwood and nearby communities. Public records are shown only when the official site can be reached and verified.",
  },
  {
    id: "noyes-development",
    name: "Noyes Development",
    domain: "noyesdevelopment.com",
    website: "https://www.noyesdevelopment.com/our-communities",
    sourceUrl: "https://www.noyesdevelopment.com/our-communities",
    summary:
      "Local Portland-area builder focused on higher-performance, semi-custom and luxury new homes in Washington County and the greater Portland area.",
  },
  {
    id: "lgi-homes",
    name: "LGI Homes",
    domain: "lgihomes.com",
    website: "https://www.lgihomes.com/oregon/portland",
    sourceUrl: "https://www.lgihomes.com/oregon/portland",
    summary:
      "National builder with Portland-area communities emphasizing move-in-ready homes, included upgrades and published community amenities and promotions.",
  },
  {
    id: "chad-e-davis",
    name: "Chad E. Davis Construction",
    domain: "chadedavisconstruction.com",
    website: "https://www.chadedavisconstruction.com/lots",
    sourceUrl: "https://www.chadedavisconstruction.com/lots",
    summary:
      "Forest Grove-based Oregon builder with current and upcoming communities across Washington County and other western Oregon markets.",
  },
  {
    id: "manor-homes",
    name: "Manor Homes",
    domain: "mymanorhome.com",
    website: "https://www.mymanorhome.com/",
    sourceUrl: "https://www.mymanorhome.com/",
    summary:
      "Southwest Washington builder focused on thoughtfully designed new homes and communities in Vancouver, Ridgefield and nearby Clark County markets.",
  },
];

export function ensureTrackedBuilders(
  data: NewConstructionData,
): {
  data: NewConstructionData;
  addedBuilders: NewConstructionBuilder[];
} {
  const builders = data.builders.map((builder) => ({ ...builder }));
  const ids = new Set(builders.map((builder) => builder.id));
  const domains = new Set(
    builders.map((builder) => normalizeDomain(builder.domain)),
  );
  const addedBuilders: NewConstructionBuilder[] = [];

  for (const tracked of TRACKED_BUILDERS) {
    if (
      ids.has(tracked.id) ||
      domains.has(normalizeDomain(tracked.domain))
    ) {
      continue;
    }

    const added = { ...tracked };
    builders.push(added);
    addedBuilders.push(added);
    ids.add(added.id);
    domains.add(normalizeDomain(added.domain));
  }

  return {
    data: {
      ...data,
      builders,
    },
    addedBuilders,
  };
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
