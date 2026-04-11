import { getAnthropic } from "@/lib/anthropic";
import { fetchTextViaJina } from "@/lib/discovery/jina";
import type { SuburbDemographics } from "@/lib/suburb-stats/types";

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

async function fetchPostcodesIoProfile(
  postcode: string,
): Promise<Partial<SuburbDemographics>> {
  const trimmed = postcode.trim();
  if (!trimmed) return {};

  const candidates = [
    `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
    `https://v0.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.status === 403) return {};
        if (!res.ok) continue;
        const json = (await res.json()) as {
          status?: number;
          result?: {
            admin_district?: string;
            region?: string;
            parliamentary_constituency?: string;
          };
        };
        if (json.status !== 200 || !json.result) continue;
        const r = json.result;
        const out: Partial<SuburbDemographics> = {};
        if (r.region) out.region = String(r.region);
        if (r.admin_district) out.adminDistrict = String(r.admin_district);
        if (r.parliamentary_constituency) {
          out.constituency = String(r.parliamentary_constituency);
        }
        return out;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      continue;
    }
  }
  return {};
}

async function fetchClaudeFromSuburbsComAu(
  postcode: string,
  suburb: string,
  state: string,
): Promise<SuburbDemographics | undefined> {
  const stateLc = state.trim().toLowerCase();
  const slug = suburbSlug(suburb);
  const targets = [
    `https://www.suburbs.com.au/${stateLc}/${slug}-${postcode}`,
    `https://www.suburbs.com.au/${stateLc}/${slug}`,
  ];

  let text = "";
  for (const target of targets) {
    const jina = await fetchTextViaJina(target);
    if (jina.ok && jina.text?.trim() && jina.text.length >= 120) {
      text = jina.text;
      break;
    }
  }

  if (!text.trim()) return undefined;

  const slice = text.slice(0, MAX_PAGE_CHARS);
  const raw = await callHaikuJson(
    "You extract Australian suburb demographic summaries. Reply with a single JSON object only, no markdown.",
    `The area is ${suburb}, ${state} ${postcode}. Extract from this suburbs.com.au (or similar) page text:

- Median age (number)
- Owner occupied % (0-100)
- Renting % (0-100)
- Median household income weekly in AUD if stated (number)
- Up to 3 main occupations or employment notes (short strings)

Return JSON: {"medianAge": number|null, "ownerOccupied": number|null, "renting": number|null, "medianWeeklyIncome": number|null, "topOccupations": string[]}

Use null for unknown fields. topOccupations may be [].

Page text:
${slice}`,
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

function mergeDemographics(
  base: Partial<SuburbDemographics>,
  overlay: SuburbDemographics | undefined,
): SuburbDemographics | undefined {
  const merged: SuburbDemographics = { ...base };
  if (overlay) {
    Object.assign(merged, overlay);
  }
  const has =
    merged.medianAge ||
    merged.ownerRatio ||
    merged.renterRatio ||
    merged.medianIncome ||
    (merged.topOccupations && merged.topOccupations.length > 0) ||
    merged.region ||
    merged.adminDistrict ||
    merged.constituency;
  return has ? merged : undefined;
}

/**
 * Postcodes.io (when it resolves) + suburbs.com.au via Jina + Claude.
 * Domain / ABS / BOCSAR scraping removed (403 via Jina).
 */
export async function fetchSuburbDemographicsCombined(
  postcode: string,
  suburb: string,
  state: string,
): Promise<SuburbDemographics | undefined> {
  const [postcodeMeta, claudeDemo] = await Promise.all([
    fetchPostcodesIoProfile(postcode),
    fetchClaudeFromSuburbsComAu(postcode, suburb, state),
  ]);
  return mergeDemographics(postcodeMeta, claudeDemo);
}
