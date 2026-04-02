import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { suburbAgencyUrls } from "@/lib/db/schema";
import { fetchTextViaJina } from "@/lib/discovery/jina";
import {
  type SuburbPreferenceContext,
  preferenceTokenToContext,
} from "@/lib/suburb-preferences";

const MAX_LISTING_URLS = 20;
const MAX_SITEMAP_FETCHES_PER_ROOT = 45;
const MAX_SITEMAP_DEPTH = 5;

/** Top-level sitemaps (fetched via Jina: `r.jina.ai/{url}`). */
const AGENCY_SITEMAP_ROOTS = [
  "https://www.raywhite.com.au/sitemap.xml",
  "https://www.ljhooker.com.au/sitemap.xml",
] as const;

export type DiscoveredAgencyRow = {
  agencyUrl: string;
  agencyName: string;
};

const ALLOWED_LISTING_HOSTS = new Set([
  "raywhite.com.au",
  "ljhooker.com.au",
]);

function listingHostOk(hostname: string): boolean {
  return ALLOWED_LISTING_HOSTS.has(hostname.replace(/^www\./, "").toLowerCase());
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

/** Pull `<loc>https://...</loc>` entries from sitemap XML or Jina text. */
function extractLocUrls(text: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]?.trim();
    if (raw) out.push(raw);
  }
  return out;
}

function isNestedSitemapUrl(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return p.endsWith(".xml") || p.includes("/sitemap");
  } catch {
    return false;
  }
}

/** Hyphen slug plus common URL patterns (e.g. hunters-hill, hunters-hill-nsw-2110). */
function suburbFilterVariants(ctx: SuburbPreferenceContext): string[] {
  const name = ctx.suburb.trim().toLowerCase();
  if (!name) return [];
  const hyphen = name.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const noSpace = name.replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const state = (ctx.state || "NSW").trim().toLowerCase();
  const pc = ctx.postcode.trim().toLowerCase();

  const variants = new Set<string>();
  if (hyphen.length >= 2) {
    variants.add(hyphen);
    if (state) variants.add(`${hyphen}-${state}`);
    if (state && pc) variants.add(`${hyphen}-${state}-${pc}`);
    if (pc) variants.add(`${hyphen}-${pc}`);
  }
  if (noSpace.length >= 2 && noSpace !== hyphen) variants.add(noSpace);

  return Array.from(variants);
}

function urlContainsSuburbVariant(url: string, variants: string[]): boolean {
  if (variants.length === 0) return false;
  const lower = url.toLowerCase();
  return variants.some((v) => v.length >= 2 && lower.includes(v));
}

/** Drop obvious non-listing pages. */
function looksLikeIndividualListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!listingHostOk(u.hostname)) return false;
    const path = u.pathname.toLowerCase();
    const qs = u.search.toLowerCase();
    if (path.length < 10) return false;
    const badPath =
      /^\/buy\/?$|^\/buy\?|\/search|\/offices?\/|\/office\/|\/franchise|\/contact|\/about|\/news|\/blog|\/team|\/careers|sitemap/i;
    if (badPath.test(path) || badPath.test(qs)) return false;
    return true;
  } catch {
    return false;
  }
}

async function gatherListingUrlsFromAgencySitemaps(
  ctx: SuburbPreferenceContext,
): Promise<string[]> {
  const variants = suburbFilterVariants(ctx);
  if (variants.length === 0) return [];

  const pageUrls: string[] = [];

  for (const root of AGENCY_SITEMAP_ROOTS) {
    const queue: { url: string; depth: number }[] = [{ url: root, depth: 0 }];
    const seenSitemapUrls = new Set<string>();
    let fetches = 0;

    while (queue.length > 0 && fetches < MAX_SITEMAP_FETCHES_PER_ROOT) {
      const next = queue.shift();
      if (!next) break;
      const { url: sitemapUrl, depth } = next;
      if (depth > MAX_SITEMAP_DEPTH) continue;
      if (seenSitemapUrls.has(sitemapUrl)) continue;
      seenSitemapUrls.add(sitemapUrl);
      fetches += 1;

      console.log("[find-agency-urls] Jina fetch sitemap:", sitemapUrl);
      const jina = await fetchTextViaJina(sitemapUrl);
      if (!jina.ok) {
        console.log(
          "[find-agency-urls] sitemap Jina failed:",
          sitemapUrl,
          jina.error,
        );
        continue;
      }

      const locs = extractLocUrls(jina.text);
      for (const loc of locs) {
        const norm = normalizeHttpsUrl(loc);
        if (!norm) continue;
        if (isNestedSitemapUrl(norm)) {
          if (depth < MAX_SITEMAP_DEPTH && !seenSitemapUrls.has(norm)) {
            queue.push({ url: norm, depth: depth + 1 });
          }
        } else {
          pageUrls.push(norm);
        }
      }
    }
  }

  const matched = pageUrls.filter(
    (u) =>
      urlContainsSuburbVariant(u, variants) && looksLikeIndividualListingUrl(u),
  );

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const u of matched) {
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
    if (unique.length >= MAX_LISTING_URLS) break;
  }

  console.log(
    "[find-agency-urls] sitemap URLs matched suburb variants:",
    unique.length,
    "variants:",
    variants,
    "sample:",
    unique.slice(0, 3),
  );

  return unique;
}

/**
 * Discover listing page URLs for a preference token by walking Ray White +
 * LJ Hooker sitemaps (via Jina), keeping URLs whose path contains the suburb
 * slug (e.g. mosman, hunters-hill). Stored in `suburb_agency_urls.agency_url`.
 */
export async function discoverAgencyUrlsForSuburb(
  preferenceToken: string,
): Promise<DiscoveredAgencyRow[]> {
  const ctx = preferenceTokenToContext(preferenceToken.trim());
  if (!ctx.suburb) return [];

  const locationLabel = ctx.postcode
    ? `${ctx.suburb} ${ctx.postcode} ${ctx.state}`
    : `${ctx.suburb}, ${ctx.state}`;

  const urls = await gatherListingUrlsFromAgencySitemaps(ctx);
  const rows: DiscoveredAgencyRow[] = urls.map((u) => ({
    agencyUrl: u,
    agencyName: agencyNameFromUrl(u),
  }));

  if (rows.length === 0) {
    console.log(
      "[find-agency-urls] no listing URLs from sitemaps for",
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
