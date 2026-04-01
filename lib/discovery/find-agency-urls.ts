import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";

import { getAnthropic } from "@/lib/anthropic";
import { getDb } from "@/lib/db";
import { suburbAgencyUrls } from "@/lib/db/schema";
import { fetchPageViaJina } from "@/lib/discovery/jina";
import {
  type SuburbPreferenceContext,
  preferenceTokenToContext,
} from "@/lib/suburb-preferences";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const PER_SOURCE_SLICE = 14_000;
const MAX_AGENCY_URLS = 8;

export type DiscoveredAgencyRow = {
  agencyUrl: string;
  agencyName: string;
};

function ljHookerSlug(suburb: string): string {
  return suburb
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Ray White expects `?suburb={encodedName}&postcode={pc}`, not slugified `suburb-nsw-pc`. */
function rayWhiteBuySearchUrl(suburbName: string, postcode: string): string {
  const s = suburbName.trim();
  const pc = postcode.trim();
  const suburbQ = encodeURIComponent(s);
  if (!pc) {
    return `https://www.raywhite.com.au/buy/?suburb=${suburbQ}`;
  }
  return `https://www.raywhite.com.au/buy/?suburb=${suburbQ}&postcode=${encodeURIComponent(pc)}`;
}

/**
 * When Claude returns no agency URLs, use these listing search URLs so the
 * scraper still has pages to fetch.
 */
export function buildFallbackAgencyUrls(
  ctx: SuburbPreferenceContext,
): DiscoveredAgencyRow[] {
  const name = ctx.suburb.trim();
  if (!name) return [];
  const pc = ctx.postcode.trim();
  const slug = ljHookerSlug(name);

  const rayWhite = rayWhiteBuySearchUrl(name, pc);

  const mcgrath = `https://www.mcgrath.com.au/buy?suburb=${encodeURIComponent(`${name} NSW`)}`;

  const ljPath = pc ? `${slug}-nsw-${pc}` : `${slug}-nsw`;
  const ljHooker = `https://www.ljhooker.com.au/buy/${ljPath}`;

  return [
    { agencyUrl: rayWhite, agencyName: "Ray White" },
    { agencyUrl: mcgrath, agencyName: "McGrath" },
    { agencyUrl: ljHooker, agencyName: "LJ Hooker" },
  ];
}

/** Target URLs (not Jina-prefixed) for agency / listing discovery seeds. */
export function buildAgencyDiscoveryTargets(ctx: SuburbPreferenceContext): {
  label: string;
  url: string;
}[] {
  const suburb = ctx.suburb.trim();
  const pc = ctx.postcode.trim();
  const enc = encodeURIComponent(suburb);
  const encPc = encodeURIComponent(pc);
  const slug = ljHookerSlug(suburb);
  const pcParam = pc ? `&postcode=${encPc}` : "";
  return [
    {
      label: "Ray White",
      url: rayWhiteBuySearchUrl(suburb, pc),
    },
    {
      label: "McGrath",
      url: `https://www.mcgrath.com.au/buy?suburb=${enc}${pcParam}`,
    },
    {
      label: "LJ Hooker",
      url: pc
        ? `https://www.ljhooker.com.au/buy/${slug}-nsw?postcode=${encPc}`
        : `https://www.ljhooker.com.au/buy/${slug}-nsw`,
    },
  ];
}

function agencyNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const brand = host.split(".")[0] ?? host;
    if (!brand) return "Agency";
    return brand
      .split(/[-_]/)
      .filter(Boolean)
      .map(
        (w) =>
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
      .join(" ");
  } catch {
    return "Agency";
  }
}

function normalizeHttpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.href;
  } catch {
    return null;
  }
}

function parseAgencyUrlArrayFromClaude(raw: string): string[] {
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) candidate = fence[1].trim();
  try {
    const v = JSON.parse(candidate) as unknown;
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === "string") {
        const n = normalizeHttpsUrl(item);
        if (n) out.push(n);
      } else if (item && typeof item === "object" && "url" in item) {
        const n = normalizeHttpsUrl(String((item as { url: unknown }).url));
        if (n) out.push(n);
      }
      if (out.length >= MAX_AGENCY_URLS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Sequential seed order — avoids concurrent Apify runs hitting memory limits. */
const AGGREGATE_FETCH_ORDER = ["Ray White", "LJ Hooker", "McGrath"] as const;

async function aggregateDiscoveryContent(
  ctx: SuburbPreferenceContext,
): Promise<string> {
  const targets = buildAgencyDiscoveryTargets(ctx);
  const byLabel = new Map(targets.map((t) => [t.label, t]));
  const ordered = AGGREGATE_FETCH_ORDER.map((label) => byLabel.get(label)).filter(
    (t): t is { label: string; url: string } => Boolean(t),
  );

  const parts: string[] = [];
  for (const { label, url } of ordered) {
    console.log("[find-agency-urls] fetching seed via Jina:", label, url);
    const jina = await fetchPageViaJina(url);
    const textChars = jina.ok ? jina.text.length : 0;
    const linkCount = jina.ok ? jina.links.length : 0;
    console.log(
      "[find-agency-urls] fetch response:",
      label,
      "ok:",
      jina.ok,
      "text chars:",
      textChars,
      "links:",
      linkCount,
    );
    if (!jina.ok) continue;
    const block =
      jina.text.length >= 40
        ? jina.text.slice(0, PER_SOURCE_SLICE)
        : jina.links.length > 0
          ? JSON.stringify(jina.links).slice(0, PER_SOURCE_SLICE)
          : "";
    if (!block) continue;
    parts.push(`--- ${label}: ${url} ---\n${block}`);
  }

  return parts.join("\n\n");
}

async function extractAgencyUrlsWithClaude(
  locationLabel: string,
  aggregatedContent: string,
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  if (!aggregatedContent.trim()) return [];

  const prompt = `From this content, extract a list of real estate agency website URLs that have property listings for sale in ${locationLabel}, Australia. Return only direct search/listing page URLs (not homepages) that would show properties for sale in this area. Return as JSON array of strings. Max ${MAX_AGENCY_URLS} URLs. Only include URLs from legitimate Australian real estate agency websites.

Content:
${aggregatedContent.slice(0, 110_000)}`;

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const text =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const parsed = parseAgencyUrlArrayFromClaude(text);
    console.log(
      "[find-agency-urls] Claude agency URL response (truncated):",
      text.slice(0, 500),
    );
    console.log(
      "[find-agency-urls] Claude parsed agency URL count:",
      parsed.length,
      parsed,
    );
    return parsed;
  } catch (error: unknown) {
    console.error("[find-agency-urls] Claude error:", error);
    if (
      error instanceof AuthenticationError ||
      (error instanceof APIError && error.status === 401)
    ) {
      return [];
    }
    if (
      error instanceof RateLimitError ||
      (error instanceof APIError && error.status === 429)
    ) {
      return [];
    }
    return [];
  }
}

/**
 * Discover agency listing-page URLs for a saved preference token
 * (`suburb|postcode|state` or legacy suburb-only string).
 */
export async function discoverAgencyUrlsForSuburb(
  preferenceToken: string,
): Promise<DiscoveredAgencyRow[]> {
  const ctx = preferenceTokenToContext(preferenceToken.trim());
  if (!ctx.suburb) return [];

  const locationLabel = ctx.postcode
    ? `${ctx.suburb} ${ctx.postcode} ${ctx.state}`
    : `${ctx.suburb}, ${ctx.state}`;

  const aggregated = await aggregateDiscoveryContent(ctx);
  console.log(
    "[find-agency-urls] aggregated content length for Claude:",
    aggregated.length,
  );
  const urls = await extractAgencyUrlsWithClaude(locationLabel, aggregated);
  const seen = new Set<string>();
  let rows: DiscoveredAgencyRow[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    rows.push({ agencyUrl: u, agencyName: agencyNameFromUrl(u) });
    if (rows.length >= MAX_AGENCY_URLS) break;
  }

  if (rows.length === 0) {
    console.log(
      "[find-agency-urls] Claude returned 0 agency URLs; using hardcoded fallbacks for",
      locationLabel,
    );
    rows = buildFallbackAgencyUrls(ctx);
    console.log(
      "[find-agency-urls] fallback agency URL count:",
      rows.length,
      rows.map((r) => r.agencyUrl),
    );
  }

  return rows;
}

export type PersistAgencyResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/** Replace stored agencies for one user + preference token (after discovery). */
export async function discoverAndPersistAgencyUrlsForSuburb(
  userId: string,
  preferenceToken: string,
): Promise<PersistAgencyResult> {
  const trimmed = preferenceToken.trim();
  if (!trimmed) {
    return { ok: false, error: "Suburb is required." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }

  try {
    const discovered = await discoverAgencyUrlsForSuburb(trimmed);
    console.log(
      "[find-agency-urls] persist: inserting into suburb_agency_urls:",
      discovered.length,
      "rows for suburb token:",
      trimmed,
    );
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .delete(suburbAgencyUrls)
        .where(
          and(
            eq(suburbAgencyUrls.userId, userId),
            eq(suburbAgencyUrls.suburb, trimmed),
          ),
        );
      if (discovered.length > 0) {
        await tx.insert(suburbAgencyUrls).values(
          discovered.map((d) => ({
            userId,
            suburb: trimmed,
            agencyName: d.agencyName,
            agencyUrl: d.agencyUrl,
            lastScrapedAt: null,
          })),
        );
      }
    });
    console.log(
      "[find-agency-urls] suburb_agency_urls transaction complete; count:",
      discovered.length,
    );
    return { ok: true, count: discovered.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discovery failed.";
    console.error("[discoverAndPersistAgencyUrlsForSuburb]", e);
    return { ok: false, error: msg };
  }
}
