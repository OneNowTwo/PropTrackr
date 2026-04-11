import { getAnthropic } from "@/lib/anthropic";
import { fetchTextViaJina } from "@/lib/discovery/jina";
import type {
  SuburbCrime,
  SuburbDemographics,
  SuburbPrices,
} from "@/lib/suburb-stats/types";

const HAIKU = "claude-haiku-20240307";
const MAX_PAGE_CHARS = 100_000;

function suburbSlug(suburb: string): string {
  return suburb.toLowerCase().replace(/\s+/g, "-");
}

function parseJsonFromClaude(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

async function callHaikuJson(
  system: string,
  userContent: string,
): Promise<unknown | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 2_048,
      system,
      messages: [{ role: "user", content: userContent }],
    });
    const block = msg.content[0];
    if (!block || block.type !== "text") return null;
    return parseJsonFromClaude(block.text);
  } catch (e) {
    console.error("[claude-suburb] call failed:", e);
    return null;
  }
}

function formatPriceField(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      const s = m >= 10 ? m.toFixed(1) : m.toFixed(2).replace(/\.?0+$/, "");
      return `$${s}M`;
    }
    return `$${Math.round(v).toLocaleString("en-AU")}`;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  return s.startsWith("$") ? s : `$${s}`;
}

function formatPercentField(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    const sign = v > 0 ? "+" : "";
    return `${sign}${v}%`;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  if (s.includes("%")) return s.startsWith("+") || s.startsWith("-") ? s : `+${s}`;
  return `${s}%`;
}

function formatDaysField(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    return `${Math.round(v)} days`;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return `${s} days`;
  return s;
}

function formatClearanceField(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    return `${Math.round(v * 10) / 10}%`;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  return s.includes("%") ? s : `${s}%`;
}

export async function fetchClaudeDomainMarket(
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbPrices | undefined> {
  const slug = suburbSlug(suburb);
  const target = `https://www.domain.com.au/suburb-profile/${slug}-${state.toLowerCase()}-${postcode}`;
  const jina = await fetchTextViaJina(target);
  if (!jina.ok || !jina.text?.trim()) return undefined;

  const text = jina.text.slice(0, MAX_PAGE_CHARS);
  const raw = await callHaikuJson(
    "You extract structured Australian property suburb statistics. Reply with a single JSON object only, no markdown.",
    `Extract from this Domain suburb profile page text:

- Median house price
- Median unit price
- 12 month price growth % (single figure for houses if one number given)
- Days on market average
- Auction clearance rate

Return JSON: {"medianHousePrice": number|null, "medianUnitPrice": number|null, "priceGrowth12m": number|null, "daysOnMarket": number|null, "clearanceRate": number|null}

Use numbers only for values (no currency symbols in JSON). Return null for any field not found.

Page text:
${text}`,
  );

  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const prices: SuburbPrices = {};
  const mh = formatPriceField(o.medianHousePrice);
  const mu = formatPriceField(o.medianUnitPrice);
  const g = formatPercentField(o.priceGrowth12m);
  const dom = formatDaysField(o.daysOnMarket);
  const clr = formatClearanceField(o.clearanceRate);
  if (mh) prices.medianHouse = mh;
  if (mu) prices.medianUnit = mu;
  if (g) prices.annualGrowthHouse = g;
  if (dom) prices.daysOnMarket = dom;
  if (clr) prices.auctionClearanceRate = clr;

  return Object.keys(prices).length ? prices : undefined;
}

export async function fetchClaudeAbsDemographics(
  postcode: string,
  suburb: string,
  state: string,
): Promise<SuburbDemographics | undefined> {
  const target = `https://www.abs.gov.au/census/find-census-data/quickstats/2021/${postcode}`;
  const jina = await fetchTextViaJina(target);
  if (!jina.ok || !jina.text?.trim()) return undefined;

  const text = jina.text.slice(0, MAX_PAGE_CHARS);
  const raw = await callHaikuJson(
    "You extract Australian Census QuickStats demographics. Reply with a single JSON object only, no markdown.",
    `The area of interest is ${suburb}, ${state} ${postcode} (postcode ${postcode}). Extract demographic data from this ABS Census QuickStats page text:

- Median age
- Median household income (weekly) in AUD
- Owner occupied % (number0-100)
- Renting % (number 0-100)
- Top 3 occupations (short labels)

Return JSON: {"medianAge": number|null, "medianWeeklyIncome": number|null, "ownerOccupied": number|null, "renting": number|null, "topOccupations": string[]}

Return null for any field not found. topOccupations can be [] if unknown.

Page text:
${text}`,
  );

  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const d: SuburbDemographics = {};
  if (typeof o.medianAge === "number" && Number.isFinite(o.medianAge)) {
    d.medianAge = String(Math.round(o.medianAge));
  }
  if (
    typeof o.medianWeeklyIncome === "number" &&
    Number.isFinite(o.medianWeeklyIncome)
  ) {
    d.medianIncome = `$${Math.round(o.medianWeeklyIncome).toLocaleString("en-AU")} / wk`;
  }
  if (typeof o.ownerOccupied === "number" && Number.isFinite(o.ownerOccupied)) {
    d.ownerRatio = `${Math.round(o.ownerOccupied)}%`;
  }
  if (typeof o.renting === "number" && Number.isFinite(o.renting)) {
    d.renterRatio = `${Math.round(o.renting)}%`;
  }
  if (Array.isArray(o.topOccupations)) {
    d.topOccupations = o.topOccupations
      .map((x) => String(x).trim())
      .filter((s) => s.length > 1)
      .slice(0, 3);
  }

  return Object.keys(d).length ? d : undefined;
}

export async function fetchClaudeBocsarCrime(
  suburb: string,
  state: string,
): Promise<SuburbCrime | undefined> {
  if (state.toUpperCase() !== "NSW") return undefined;

  const slug = suburbSlug(suburb);
  let target = `https://www.bocsar.nsw.gov.au/Pages/bocsar_pages/crime_stat/${slug}.aspx`;
  let jina = await fetchTextViaJina(target);
  if (!jina.ok || !jina.text || jina.text.length < 120) {
    target = `https://www.bocsar.nsw.gov.au/Pages/bocsar_pages/lga_stat.aspx`;
    jina = await fetchTextViaJina(target);
  }
  if (!jina.ok || !jina.text?.trim()) return undefined;

  const text = jina.text.slice(0, MAX_PAGE_CHARS);
  const raw = await callHaikuJson(
    "You extract NSW crime statistics for buyers. Reply with a single JSON object only, no markdown.",
    `From this NSW BOCSAR crime statistics page, extract data relevant to the suburb "${suburb}".

Return JSON: {
  "overallLevel": "Low" | "Medium" | "High" | null,
  "topCrimes": [{"type": string, "count": number|null, "trend": string|null}],
  "comparedToNSWAverage": string|null
}

If the page is LGA-level and does not name "${suburb}" specifically, infer best-effort for the area or set overallLevel and topCrimes to null. comparedToNSWAverage should be a short phrase like "12% below NSW average" if inferable, else null.

Page text:
${text}`,
  );

  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const levelRaw = o.overallLevel;
  const level =
    levelRaw === "Low" || levelRaw === "Medium" || levelRaw === "High"
      ? levelRaw
      : undefined;

  let topCrimes: SuburbCrime["topCrimes"];
  if (Array.isArray(o.topCrimes)) {
    topCrimes = o.topCrimes
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const t = item as Record<string, unknown>;
        const type = typeof t.type === "string" ? t.type : "";
        if (!type.trim()) return null;
        const count =
          typeof t.count === "number" && Number.isFinite(t.count)
            ? t.count
            : null;
        const trend =
          typeof t.trend === "string" && t.trend.trim() ? t.trend : null;
        return { type: type.trim(), count, trend };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .slice(0, 6);
  }

  const compared =
    typeof o.comparedToNSWAverage === "string" && o.comparedToNSWAverage.trim()
      ? o.comparedToNSWAverage.trim()
      : undefined;

  const categories: SuburbCrime["categories"] =
    topCrimes?.map((c) => ({
      name: c.type,
      rate:
        c.count != null
          ? String(c.count)
          : c.trend
            ? c.trend
            : "—",
    })) ?? undefined;

  if (!level && !topCrimes?.length && !compared) return undefined;

  return {
    level,
    topCrimes,
    comparedToNSWAverage: compared,
    categories,
    summary: compared,
  };
}
