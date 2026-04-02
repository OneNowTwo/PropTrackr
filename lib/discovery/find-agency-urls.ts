import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";

import { getAnthropic } from "@/lib/anthropic";
import { getDb } from "@/lib/db";
import { suburbAgencyUrls } from "@/lib/db/schema";
import { fetchTextViaJina } from "@/lib/discovery/jina";
import {
  type SuburbPreferenceContext,
  preferenceTokenToContext,
} from "@/lib/suburb-preferences";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_LISTING_URLS = 20;
const SERP_CHAR_SLICE = 110_000;

export type DiscoveredAgencyRow = {
  agencyUrl: string;
  agencyName: string;
};

const ALLOWED_LISTING_HOSTS = new Set([
  "raywhite.com.au",
  "ljhooker.com.au",
  "mcgrath.com.au",
]);

function listingHostOk(hostname: string): boolean {
  return ALLOWED_LISTING_HOSTS.has(hostname.replace(/^www\./, "").toLowerCase());
}

/**
 * DuckDuckGo HTML SERP (Jina-friendly); fetched through `fetchTextViaJina`.
 * Kept name `buildGoogleAuListingSearchUrl` for stable imports.
 */
export function buildGoogleAuListingSearchUrl(
  ctx: SuburbPreferenceContext,
): string {
  const suburb = ctx.suburb.trim();
  const state = (ctx.state || "NSW").trim();
  const q = `${suburb} ${state} property for sale site:raywhite.com.au OR site:ljhooker.com.au OR site:mcgrath.com.au`;
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
}

/** Bing fallback when DuckDuckGo via Jina fails. */
function buildBingListingSearchUrl(ctx: SuburbPreferenceContext): string {
  const suburb = ctx.suburb.trim();
  const state = (ctx.state || "NSW").trim();
  const q = `${suburb} ${state} property for sale site:raywhite.com.au`;
  return `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
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

function parseUrlStringArrayFromClaude(raw: string): string[] {
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
      if (out.length >= MAX_LISTING_URLS * 2) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Drop SERP / search / office URLs; keep likely individual listing pages. */
function looksLikeIndividualListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!listingHostOk(u.hostname)) return false;
    const path = u.pathname.toLowerCase();
    const qs = u.search.toLowerCase();
    if (path.length < 10) return false;
    const badPath =
      /^\/buy\/?$|^\/buy\?|\/search|\/offices?\/|\/office\/|\/franchise|\/contact|\/about|\/news|\/blog|\/team|\/careers/i;
    if (badPath.test(path) || badPath.test(qs)) return false;
    return true;
  } catch {
    return false;
  }
}

async function extractPropertyListingUrlsWithClaude(
  serpPlainText: string,
  locationLabel: string,
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const body = serpPlainText.trim();
  if (!body) return [];

  const prompt = `You are given plain text from a web search results page (via a text reader). Extract ONLY direct https URLs to individual residential property FOR SALE listing detail pages on raywhite.com.au, ljhooker.com.au, or mcgrath.com.au.

Rules:
- Each URL must be a single property listing (a page about one address), not a suburb search, not /buy filters, not office or team pages, not blogs.
- Prefer listings clearly in or near: ${locationLabel}.
- Return JSON array of strings only, max ${MAX_LISTING_URLS} URLs. No markdown fences, no commentary.

Search / result text:
${body.slice(0, SERP_CHAR_SLICE)}`;

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const text =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const parsed = parseUrlStringArrayFromClaude(text);
    const filtered = parsed.filter(looksLikeIndividualListingUrl);
    console.log(
      "[find-agency-urls] Claude listing URLs parsed:",
      filtered.length,
      filtered.slice(0, 5),
    );
    return filtered.slice(0, MAX_LISTING_URLS);
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
 * Discover individual property listing page URLs for a preference token
 * (`suburb|postcode|state`) via DuckDuckGo HTML (Jina) + Claude, with Bing fallback.
 * Rows are stored in `suburb_agency_urls.agency_url` (legacy column name).
 */
export async function discoverAgencyUrlsForSuburb(
  preferenceToken: string,
): Promise<DiscoveredAgencyRow[]> {
  const ctx = preferenceTokenToContext(preferenceToken.trim());
  if (!ctx.suburb) return [];

  const locationLabel = ctx.postcode
    ? `${ctx.suburb} ${ctx.postcode} ${ctx.state}`
    : `${ctx.suburb}, ${ctx.state}`;

  const ddgUrl = buildGoogleAuListingSearchUrl(ctx);
  console.log("[find-agency-urls] fetching SERP (DuckDuckGo) via Jina:", ddgUrl);

  let jina = await fetchTextViaJina(ddgUrl);
  if (!jina.ok) {
    const bingUrl = buildBingListingSearchUrl(ctx);
    console.log(
      "[find-agency-urls] DuckDuckGo/Jina failed, trying Bing:",
      jina.error,
      "→",
      bingUrl,
    );
    jina = await fetchTextViaJina(bingUrl);
  }
  if (!jina.ok) {
    console.log("[find-agency-urls] Jina SERP fetch failed (DDG + Bing):", jina.error);
    return [];
  }

  const urls = await extractPropertyListingUrlsWithClaude(
    jina.text,
    locationLabel,
  );
  const seen = new Set<string>();
  const rows: DiscoveredAgencyRow[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    rows.push({ agencyUrl: u, agencyName: agencyNameFromUrl(u) });
  }

  if (rows.length === 0) {
    console.log(
      "[find-agency-urls] no listing URLs from SERP + Claude for",
      locationLabel,
    );
  }

  return rows;
}

export type PersistAgencyResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/** Replace stored listing seeds for one user + preference token. */
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
      "[find-agency-urls] persist suburb_agency_urls:",
      discovered.length,
      "listing URL(s) for token:",
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
    return { ok: true, count: discovered.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discovery failed.";
    console.error("[discoverAndPersistAgencyUrlsForSuburb]", e);
    return { ok: false, error: msg };
  }
}
