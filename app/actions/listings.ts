"use server";

import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic";
import {
  normalizeAustralianState,
  normalizePropertyTypeForDb,
} from "@/lib/listing/normalize";
import {
  normalizeAuctionDate,
  normalizeAuctionTime,
  normalizeInspectionDatesFromExtract,
  type InspectionDateSlot,
} from "@/lib/listing/inspection-autofill";

const MAX_HTML_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
} as const;

export type ExtractedListingFields = {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  propertyType: string;
  listingUrl: string;
  imageUrl: string;
  /** Up to 7 extra listing photos (hero is imageUrl); max 8 images total. */
  imageUrls: string[];
  notes: string;
  agentName: string;
  agencyName: string;
  agentPhotoUrl: string;
  agentEmail: string;
  agentPhone: string;
  inspectionDates: InspectionDateSlot[];
  auctionDate: string;
  auctionTime: string;
  auctionVenue: string;
};

function extractJsonLdBlocks(html: string): string {
  const blocks: string[] = [];
  const re =
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1]?.trim();
    if (inner) blocks.push(inner);
  }
  return blocks.join("\n\n");
}

function stripHeavyMarkup(html: string): string {
  const jsonLd = extractJsonLdBlocks(html);
  const htmlStripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const prefix = jsonLd
    ? `--- JSON-LD (application/ld+json) — use for agent & listing structured data ---\n${jsonLd}\n\n--- Page HTML (scripts/styles stripped) ---\n`
    : "";

  return (prefix + htmlStripped).slice(0, MAX_HTML_CHARS);
}

type ListingExtractJson = {
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  propertyType?: string | null;
  /** Preferred key from model JSON (matches system prompt). */
  imageUrl?: string | null;
  /** Legacy key if the model still returns it. */
  primaryImageUrl?: string | null;
  /** Additional listing photos (https), excluding the hero if possible. */
  imageUrls?: (string | null)[] | null;
  notesSummary?: string | null;
  agentName?: string | null;
  agencyName?: string | null;
  agentPhotoUrl?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  inspectionDates?: unknown;
  auctionDate?: string | null;
  auctionTime?: string | null;
  auctionVenue?: string | null;
};

const SYSTEM_PROMPT = `You extract Australian residential property listing details from page content (HTML or plain text, including full text from a reader service such as Jina).

Return ONLY a valid JSON object with these exact keys: address, suburb, state, postcode, price, bedrooms, bathrooms, parkingSpaces, propertyType, imageUrl, imageUrls, notesSummary, agentName, agencyName, agentPhotoUrl, agentEmail, agentPhone, inspectionDates, auctionDate, auctionTime, auctionVenue. For notesSummary extract the property description copy and summarise into 5-8 bullet points starting with •. Return null for any field you cannot find.

Extract all open home / inspection times as an array of {date, startTime, endTime} in ISO date format (YYYY-MM-DD) and 24hr time (HH:MM). Also extract auction date, time and venue if present.
Australian sites show these as 'Inspection', 'Open home', 'Open for inspection' with dates like 'Saturday 4th April, 1:45PM - 2:15PM' — convert these to the correct year (2026) and ISO format.
inspectionDates: JSON array of objects like [{"date":"2026-04-05","startTime":"14:30","endTime":"15:00"}] or null if none. auctionDate: YYYY-MM-DD or null. auctionTime: HH:MM 24hr or null. auctionVenue: string or null.

Agent fields (try very hard — many sites hide them outside obvious body copy):
- Look carefully for agent information in JSON-LD script tags (type application/ld+json), especially @type Person, RealEstateAgent, RealEstateListing agent/broker fields, and nested Organization.
- Check meta tags (og:description, twitter:description, and other meta) — agent names often appear there.
- Inspect data-* attributes on agent or contact blocks and common class patterns such as .agent-name, .agent-details, .listing-agent, [class*="agent"], contact/salesperson sections.
- Australian real estate sites like Ray White, McGrath, LJ Hooker, and Domain often embed agent name, phone, email, photo, and office in structured data — parse those first when HTML includes them.

suburb (critical): Must be the suburb/locality where the property is located (from the listing headline, address line, or breadcrumb for the property). Never use the real estate office, branch, franchise location, or "Presented by" office suburb — e.g. if the page shows an office in Riverhead but the property address is in Kumeū, return Kumeū for suburb.

IMPORTANT: Extract the suburb and state from the property address itself, NOT from the agency office location or branch name. Australian postcodes: NSW=2xxx, VIC=3xxx, QLD=4xxx, SA=5xxx, WA=6xxx, TAS=7xxx. Use the postcode to verify the correct state.

Ray White and LJ Hooker listing pages (including reader/plain-text views): Often show beds/baths/parking as labelled lines such as "Beds 3", "Baths 2", "Car spaces 1", "Cars 2", or "Bedrooms: 4" — extract those integers into bedrooms, bathrooms, and parkingSpaces. Listing photos often appear as absolute https URLs in the body or markdown; include the main hero in imageUrl and extras in imageUrls.

notesSummary must be 5-8 bullet points starting with • summarising key property features from the listing description (aspect, renovations, amenities, location, parking, outdoor space, buyer-relevant details). Plain text only, no headings.

Field types: address, suburb, state, postcode as strings or null (state: NSW, VIC, QLD, SA, WA, TAS, ACT, NT when known). price: number|null whole AUD for main sale price (not weekly rent unless only rent shown). bedrooms, bathrooms, parkingSpaces: number|null. propertyType: House, Apartment, Townhouse, Unit, Land, Other, or null. imageUrl: main hero listing photo absolute https URL or null. imageUrls: JSON array of up to 7 additional property listing photo absolute https URLs only (same listing, no agent headshots, no logos, no maps), or null if none. Do not duplicate imageUrl inside imageUrls. agentPhotoUrl: agent headshot absolute https URL or null.

Do not use markdown code fences. Do not add extra keys or commentary. Output the JSON object only.`;

const USER_OUTPUT_REMINDER = `

Your task: respond with a single JSON object only, using exactly these keys: address, suburb, state, postcode, price, bedrooms, bathrooms, parkingSpaces, propertyType, imageUrl, imageUrls, notesSummary, agentName, agencyName, agentPhotoUrl, agentEmail, agentPhone, inspectionDates, auctionDate, auctionTime, auctionVenue. Fill notesSummary, imageUrls (extra listing photos), inspectionDates (open homes / inspections as {date,startTime,endTime}), auction fields, and all agent fields from this page when present; use null for unknown values. Prioritise JSON-LD (application/ld+json), meta tags, and structured agent blocks for agentName, agencyName, agentPhotoUrl, agentEmail, and agentPhone.`;

function looksLikeBlockedOrShellHtml(html: string): boolean {
  const sample = html.slice(0, 80_000).toLowerCase();
  if (html.length > 0 && html.length < 1_200) {
    const hints =
      /property|bedroom|bathroom|\$\s*\d|address|postcode|suburb|for sale|auction/i;
    if (!hints.test(html)) return true;
  }
  if (
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-challenge") ||
    sample.includes("challenge-platform")
  ) {
    return true;
  }
  if (
    sample.includes("just a moment") &&
    (sample.includes("cloudflare") || sample.includes("checking your browser"))
  ) {
    return true;
  }
  if (
    sample.includes("attention required") &&
    sample.includes("cloudflare")
  ) {
    return true;
  }
  if (sample.includes("access denied") && sample.includes("you don't have permission")) {
    return true;
  }
  if (
    /blocked.*bot|bot.*blocked|automated access/i.test(sample) &&
    sample.length < 15_000
  ) {
    return true;
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchViaJinaReader(
  listingUrl: string,
): Promise<
  { ok: true; body: string } | { ok: false; error: string }
> {
  const jinaUrl = `https://r.jina.ai/${listingUrl}`;
  try {
    const res = await fetchWithTimeout(jinaUrl, { ...BROWSER_HEADERS });
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not load the page (HTTP ${res.status}). Try copying details manually.`,
      };
    }
    const text = await res.text();
    if (text.length < 40) {
      return {
        ok: false,
        error:
          "Could not read enough content from that URL. Fill the form manually.",
      };
    }
    return { ok: true, body: text.slice(0, MAX_HTML_CHARS) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("abort")) {
      return {
        ok: false,
        error: "The page took too long to load. Try again.",
      };
    }
    return {
      ok: false,
      error:
        "Could not fetch that URL. Some sites block automated access — fill the form manually.",
    };
  }
}

async function fetchListingPageContent(
  listingUrl: string,
): Promise<
  | { ok: true; payload: string; format: "html" | "text" }
  | { ok: false; error: string }
> {
  let res: Response;
  try {
    res = await fetchWithTimeout(listingUrl, { ...BROWSER_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("abort")) {
      const jina = await fetchViaJinaReader(listingUrl);
      if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
      return { ok: false, error: "The page took too long to load. Try again." };
    }
    const jina = await fetchViaJinaReader(listingUrl);
    if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
    return {
      ok: false,
      error:
        "Could not fetch that URL. Some sites block automated access — fill the form manually.",
    };
  }

  if (!res.ok) {
    const jina = await fetchViaJinaReader(listingUrl);
    if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
    return {
      ok: false,
      error: `Could not load the page (HTTP ${res.status}). Try copying details manually.`,
    };
  }

  let body: string;
  try {
    body = await res.text();
  } catch {
    const jina = await fetchViaJinaReader(listingUrl);
    if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
    return {
      ok: false,
      error:
        "Could not read the page body. Try again or paste listing details manually.",
    };
  }

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const looksHtml =
    ct.includes("text/html") ||
    ct.includes("application/xhtml") ||
    /^\s*</.test(body);

  if (!looksHtml) {
    if (body.length > 200) {
      return {
        ok: true,
        payload: body.slice(0, MAX_HTML_CHARS),
        format: "text",
      };
    }
    const jina = await fetchViaJinaReader(listingUrl);
    if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
    return {
      ok: false,
      error:
        "The URL did not return usable content. Open the listing in a browser and paste again.",
    };
  }

  if (looksLikeBlockedOrShellHtml(body)) {
    const jina = await fetchViaJinaReader(listingUrl);
    if (jina.ok) return { ok: true, payload: jina.body, format: "text" };
  }

  return {
    ok: true,
    payload: stripHeavyMarkup(body),
    format: "html",
  };
}

/** Best-effort parse: fenced JSON, substring object, or {} — never throws. */
function parseListingExtractJson(raw: string): ListingExtractJson {
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    candidate = fence[1].trim();
  }

  const tryParse = (s: string): ListingExtractJson | null => {
    try {
      const v = JSON.parse(s) as unknown;
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as ListingExtractJson)
        : null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (parsed) return parsed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    parsed = tryParse(candidate.slice(start, end + 1));
    if (parsed) return parsed;
  }

  return {};
}

function resolveUrl(raw: string, baseUrl: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t, baseUrl);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* ignore */
  }
  return "";
}

function junkImageUrl(u: string): boolean {
  const lower = u.toLowerCase();
  return /favicon|gravatar|doubleclick|facebook\.com\/tr|analytics|pixel\.gif|spacer|blank\.gif|clear\.gif|1x1|beacon|google-analytics|logo|icon-|sprite|avatar|profile-photo|agent-headshot|headshot|maps\.google|gstatic\.com\/maps|\.svg(\?|$)|webpack|bundle\.js|placeholder|spinner|loading\.gif|emoji|wp-content\/plugins\/|\/ads?\//i.test(
    lower,
  );
}

/** Dedupe variants that only differ by resize query params. */
function urlCanonicalKey(absUrl: string): string {
  try {
    const u = new URL(absUrl);
    u.hash = "";
    const drop = new Set([
      "w",
      "h",
      "width",
      "height",
      "quality",
      "q",
      "auto",
      "fit",
      "crop",
    ]);
    const sp = new URLSearchParams(u.search);
    for (const k of Array.from(sp.keys())) {
      if (drop.has(k.toLowerCase())) sp.delete(k);
    }
    u.search = sp.toString() ? `?${sp.toString()}` : "";
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return absUrl.toLowerCase();
  }
}

function extractUrlsFromImgTag(tag: string): string[] {
  const urls: string[] = [];
  const attrPatterns = [
    /\bsrc\s*=\s*["']([^"']+)["']/i,
    /\bdata-src\s*=\s*["']([^"']+)["']/i,
    /\bdata-lazy-src\s*=\s*["']([^"']+)["']/i,
    /\bdata-original\s*=\s*["']([^"']+)["']/i,
    /\bdata-lazy\s*=\s*["']([^"']+)["']/i,
    /\bdata-zoom-image\s*=\s*["']([^"']+)["']/i,
    /\bdata-large_image\s*=\s*["']([^"']+)["']/i,
    /\bdata-lazyload\s*=\s*["']([^"']+)["']/i,
    /\bdata-image\s*=\s*["']([^"']+)["']/i,
    /\bdata-full\s*=\s*["']([^"']+)["']/i,
    /\bdata-slide\s*=\s*["']([^"']+)["']/i,
    /\bdata-photo\s*=\s*["']([^"']+)["']/i,
    /\bdata-url\s*=\s*["']([^"']+)["']/i,
    /\bdata-hi-res\s*=\s*["']([^"']+)["']/i,
    /\bdata-carousel\s*=\s*["']([^"']+)["']/i,
    /\bdata-media\s*=\s*["']([^"']+)["']/i,
  ];
  for (const re of attrPatterns) {
    const m = tag.match(re);
    if (m?.[1]?.trim()) urls.push(m[1].trim());
  }
  for (const attr of ["srcset", "data-srcset"]) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
    const m = tag.match(re);
    if (!m?.[1]) continue;
    for (const part of m[1].split(",")) {
      const u = part.trim().split(/\s+/)[0]?.trim();
      if (u) urls.push(u);
    }
  }
  return urls;
}

/** Images inside carousel / slider slide markup (lazy attrs common here). */
function extractCarouselSlideImageRaw(html: string): string[] {
  const raw: string[] = [];
  const slideRe =
    /<(?:div|li|figure)[^>]*class=["'][^"']*(?:swiper-slide|slick-slide|carousel-item|splide__slide|keen-slider__slide|flickity-slider|rsSlide|owl-item)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|li|figure)>/gi;
  let m: RegExpExecArray | null;
  while ((m = slideRe.exec(html)) !== null) {
    const chunk = m[1] ?? "";
    const imgRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(chunk)) !== null) {
      raw.push(...extractUrlsFromImgTag(im[0]));
    }
  }
  return raw;
}

function isGalleryRelatedClassList(classAttr: string): boolean {
  const c = classAttr.toLowerCase();
  if (
    /\b(profile-photo|agent-headshot|agent-photo|user-photo|team-photo)\b/.test(
      c,
    )
  ) {
    return false;
  }
  if (
    /\b(property-gallery|listing-photos|media-gallery|image-gallery)\b/.test(c)
  ) {
    return true;
  }
  if (/\bgallery\b/.test(c)) return true;
  if (c.includes("slider") && !/\b(range-slider|nav-slider|input-slider)\b/.test(c))
    return true;
  if (
    c.includes("photo") &&
    (c.includes("listing") ||
      c.includes("property") ||
      c.includes("media") ||
      c.includes("image") ||
      c.includes("gallery") ||
      c.includes("carousel"))
  ) {
    return true;
  }
  return false;
}

/** Scan opening tags with gallery-like classes; take following window for <img> URLs. */
function extractGalleryContainerImageRaw(html: string): string[] {
  const raw: string[] = [];
  const openRe =
    /<(?:div|section|ul|article)\b[^>]*\bclass=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    if (!isGalleryRelatedClassList(m[1] ?? "")) continue;
    const start = m.index + m[0].length;
    const chunk = html.slice(start, start + 25_000);
    const imgRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(chunk)) !== null) {
      raw.push(...extractUrlsFromImgTag(im[0]));
    }
  }
  return raw;
}

function extractFigureImageRaw(html: string): string[] {
  const raw: string[] = [];
  const figRe = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
  let m: RegExpExecArray | null;
  while ((m = figRe.exec(html)) !== null) {
    const chunk = m[1] ?? "";
    const imgRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(chunk)) !== null) {
      raw.push(...extractUrlsFromImgTag(im[0]));
    }
  }
  return raw;
}

function extractPictureSourceRaw(html: string): string[] {
  const raw: string[] = [];
  const picRe = /<picture\b[^>]*>([\s\S]*?)<\/picture>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = picRe.exec(html)) !== null) {
    const inner = pm[1] ?? "";
    const srcsetRe = /<source[^>]+srcset\s*=\s*["']([^"']+)["']/gi;
    let sm: RegExpExecArray | null;
    while ((sm = srcsetRe.exec(inner)) !== null) {
      for (const part of sm[1].split(",")) {
        const u = part.trim().split(/\s+/)[0]?.trim();
        if (u) raw.push(u);
      }
    }
    const imgRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(inner)) !== null) {
      raw.push(...extractUrlsFromImgTag(im[0]));
    }
  }
  return raw;
}

function collectLdImageUrls(node: unknown, out: string[], depth: number): void {
  if (depth > 28) return;
  if (node == null) return;
  if (typeof node === "string") {
    const s = node.trim();
    if (/^https?:\/\//i.test(s)) out.push(s);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectLdImageUrls(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const typeStr = String(o["@type"] ?? "");
  if (/ImageObject/i.test(typeStr)) {
    collectLdImageUrls(o.url, out, depth + 1);
    collectLdImageUrls(o.contentUrl, out, depth + 1);
    return;
  }
  if (o.image != null) collectLdImageUrls(o.image, out, depth + 1);
  if (Array.isArray(o["@graph"])) collectLdImageUrls(o["@graph"], out, depth + 1);
  if (o.mainEntity != null) collectLdImageUrls(o.mainEntity, out, depth + 1);
  if (o.about != null) collectLdImageUrls(o.about, out, depth + 1);
}

function extractJsonLdImageUrlsRaw(html: string): string[] {
  const out: string[] = [];
  const re =
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1]?.trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner) as unknown;
      collectLdImageUrls(parsed, out, 0);
    } catch {
      /* ignore invalid JSON-LD */
    }
  }
  return out;
}

function looksLikePropertyImageUrl(u: string): boolean {
  if (!u || junkImageUrl(u)) return false;
  const lower = u.toLowerCase();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.(jpe?g|png|webp|avif)(\?|#|$|\/|&)/i.test(u)) return true;
  if (
    /raywhite|ljhooker|murphy|propertyfiles|list-on|imageflow|imgsizer|cloudinary|imgix|resi\.|listingcdn|property-image|realestate\.com\.au|domain\.com\.au|\/listing\/|\/sale\/|\/properties?\/|\/residential\/|\/media\/|\/photos?\/|\/images?\/|digitalocean|amazonaws|cloudfront|imagedelivery|cdn/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (
    /\/sale\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/\d{5,}/i.test(lower) ||
    /listing-?images?|property-?images?|gallery-?image|carousel-?img/i.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

/** Pull https image URLs from reader/plain-text pages (markdown, bare URLs). */
function extractImageUrlsFromPlainText(
  text: string,
  baseUrl: string,
  max = 8,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    if (out.length >= max) return;
    const cleaned = raw.replace(/[),.;:!?'"\]}]+$/, "").trim();
    if (!cleaned || cleaned.startsWith("data:")) return;
    const u = resolveUrl(cleaned, baseUrl);
    if (!u || junkImageUrl(u) || !looksLikePropertyImageUrl(u)) return;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    } catch {
      return;
    }
    const key = urlCanonicalKey(u);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(u);
  };

  const mdRe = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(text)) !== null) {
    push(m[1] ?? "");
    if (out.length >= max) return out;
  }

  const bareRe = /https?:\/\/[^\s"'<>\])]+/gi;
  while ((m = bareRe.exec(text)) !== null) {
    push(m[0] ?? "");
    if (out.length >= max) return out;
  }

  return out;
}

type ListingStatsHeuristic = {
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
};

/**
 * Best-effort beds/baths/parking from common AU/NZ agency copy (reader text or HTML stripped).
 */
function extractListingStatsHeuristics(text: string): ListingStatsHeuristic {
  const t = text.slice(0, 100_000);
  const out: ListingStatsHeuristic = {};

  const bedFromLabel = t.match(
    /\b(?:bed|beds|bedroom|bedrooms)\b[:\s]+(\d{1,2})\b/i,
  );
  const bedBeforeWord = t.match(
    /\b(\d{1,2})\s*(?:bed|beds|bedroom|bedrooms)\b/i,
  );
  const bedsRw = t.match(/\bBeds\b[:\s]+(\d{1,2})\b/i);
  const nBed = bedsRw?.[1] ?? bedFromLabel?.[1] ?? bedBeforeWord?.[1];
  if (nBed != null) {
    const n = Number.parseInt(nBed, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 50) out.bedrooms = n;
  }

  const bathFromLabel = t.match(
    /\b(?:bath|baths|bathroom|bathrooms)\b[:\s]+(\d{1,2})\b/i,
  );
  const bathBeforeWord = t.match(
    /\b(\d{1,2})\s*(?:bath|baths|bathroom|bathrooms)\b/i,
  );
  const bathsRw = t.match(/\bBaths\b[:\s]+(\d{1,2})\b/i);
  const nBath = bathsRw?.[1] ?? bathFromLabel?.[1] ?? bathBeforeWord?.[1];
  if (nBath != null) {
    const n = Number.parseInt(nBath, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 50) out.bathrooms = n;
  }

  const carLabel = t.match(
    /\b(?:car\s*spaces?|parking\s*spaces?|lock-?up\s*garages?|garages?)\b[:\s]+(\d{1,2})\b/i,
  );
  const carsRw = t.match(/\bCar(?:s)?\b[:\s]+(\d{1,2})\b/i);
  const nCar = carsRw?.[1] ?? carLabel?.[1];
  if (nCar != null) {
    const n = Number.parseInt(nCar, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 50) out.parkingSpaces = n;
  }

  return out;
}

function mergeHeuristicsIntoParsed(
  parsed: ListingExtractJson,
  heuristics: ListingStatsHeuristic,
): ListingExtractJson {
  return {
    ...parsed,
    bedrooms:
      parsed.bedrooms != null && Number.isFinite(parsed.bedrooms)
        ? parsed.bedrooms
        : (heuristics.bedrooms ?? null),
    bathrooms:
      parsed.bathrooms != null && Number.isFinite(parsed.bathrooms)
        ? parsed.bathrooms
        : (heuristics.bathrooms ?? null),
    parkingSpaces:
      parsed.parkingSpaces != null && Number.isFinite(parsed.parkingSpaces)
        ? parsed.parkingSpaces
        : (heuristics.parkingSpaces ?? null),
  };
}

function dedupeImageUrls(urls: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    const key = urlCanonicalKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

type ImageHtmlExtractionResult = {
  urls: string[];
  methodCounts: Record<string, number>;
};

/**
 * Collect up to `max` listing image candidates from raw HTML (meta, JSON-LD,
 * carousel slides, gallery containers, figure/picture, all img, global srcset).
 */
function extractImageUrlsFromHtml(
  html: string,
  baseUrl: string,
  max = 8,
): ImageHtmlExtractionResult {
  const methodCounts: Record<string, number> = {};
  const seenCanonical = new Set<string>();
  const out: string[] = [];

  function pushRaw(
    rawPart: string | undefined | null,
    method: string,
  ): void {
    if (out.length >= max) return;
    const t = String(rawPart ?? "").trim();
    if (!t || t.startsWith("data:")) return;
    const u = resolveUrl(t, baseUrl);
    if (!u || junkImageUrl(u) || !looksLikePropertyImageUrl(u)) return;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    } catch {
      return;
    }
    const key = urlCanonicalKey(u);
    if (seenCanonical.has(key)) return;
    seenCanonical.add(key);
    out.push(u);
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
  }

  function pushList(rawList: string[], method: string): void {
    for (const r of rawList) {
      pushRaw(r, method);
      if (out.length >= max) return;
    }
  }

  const metaLinkRes: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
  ];

  for (const re of metaLinkRes) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      pushRaw(m[1], "meta");
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }

  if (out.length < max) {
    pushList(extractJsonLdImageUrlsRaw(html), "jsonLd");
  }
  if (out.length < max) {
    pushList(extractCarouselSlideImageRaw(html), "carouselSlide");
  }
  if (out.length < max) {
    pushList(extractGalleryContainerImageRaw(html), "galleryContainer");
  }
  if (out.length < max) {
    pushList(extractFigureImageRaw(html), "figure");
  }
  if (out.length < max) {
    pushList(extractPictureSourceRaw(html), "picture");
  }
  if (out.length < max) {
    const imgTagRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgTagRe.exec(html)) !== null) {
      for (const raw of extractUrlsFromImgTag(im[0])) {
        pushRaw(raw, "imgTag");
        if (out.length >= max) break;
      }
      if (out.length >= max) break;
    }
  }
  if (out.length < max) {
    const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
    let ms: RegExpExecArray | null;
    while ((ms = srcsetRe.exec(html)) !== null) {
      const parts = ms[1].split(",");
      for (const part of parts) {
        const urlPart = part.trim().split(/\s+/)[0];
        pushRaw(urlPart, "srcset");
        if (out.length >= max) break;
      }
      if (out.length >= max) break;
    }
  }

  console.log("[images] extracted:", out.length, "via:", methodCounts);

  return { urls: out, methodCounts: { ...methodCounts } };
}

function mergeListingImages(
  scraped: string[],
  parsed: ListingExtractJson,
  listingUrl: string,
): { imageUrl: string; imageUrls: string[] } {
  const heroFromJson = resolveUrl(
    String(parsed.imageUrl ?? parsed.primaryImageUrl ?? ""),
    listingUrl,
  );
  const fromJson: string[] = [];
  if (Array.isArray(parsed.imageUrls)) {
    for (const item of parsed.imageUrls) {
      if (item == null) continue;
      const u = resolveUrl(String(item), listingUrl);
      if (u && !junkImageUrl(u)) fromJson.push(u);
    }
  }
  const seen = new Set<string>();
  const merged: string[] = [];
  const add = (u: string) => {
    if (!u || junkImageUrl(u) || !looksLikePropertyImageUrl(u)) return;
    const key = urlCanonicalKey(u);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(u);
  };
  for (const u of scraped) add(u);
  if (heroFromJson) add(heroFromJson);
  for (const u of fromJson) add(u);
  const limited = merged.slice(0, 8);
  return {
    imageUrl: limited[0] ?? "",
    imageUrls: limited.slice(1),
  };
}

function listingJsonToFields(
  parsedJson: ListingExtractJson,
  listingUrl: string,
  scrapedUrls: string[],
): ExtractedListingFields {
  const state = normalizeAustralianState(parsedJson.state ?? undefined);
  const propertyType =
    normalizePropertyTypeForDb(parsedJson.propertyType ?? undefined) ?? "";

  const n = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? String(Math.round(v)) : "";

  const { imageUrl, imageUrls } = mergeListingImages(
    scrapedUrls,
    parsedJson,
    listingUrl,
  );
  const agentPhotoUrl = resolveUrl(parsedJson.agentPhotoUrl ?? "", listingUrl);

  const notes = (parsedJson.notesSummary ?? "").trim();
  const inspectionDates = normalizeInspectionDatesFromExtract(
    parsedJson.inspectionDates,
  );
  const auctionDate = normalizeAuctionDate(parsedJson.auctionDate ?? "");
  const auctionTime = normalizeAuctionTime(parsedJson.auctionTime ?? "");
  const auctionVenue = (parsedJson.auctionVenue ?? "").trim();

  return {
    address: (parsedJson.address ?? "").trim(),
    suburb: (parsedJson.suburb ?? "").trim(),
    state,
    postcode: (parsedJson.postcode ?? "").trim(),
    price: n(parsedJson.price),
    bedrooms: n(parsedJson.bedrooms),
    bathrooms: n(parsedJson.bathrooms),
    parking: n(parsedJson.parkingSpaces),
    propertyType,
    listingUrl,
    imageUrl,
    imageUrls,
    notes,
    agentName: (parsedJson.agentName ?? "").trim(),
    agencyName: (parsedJson.agencyName ?? "").trim(),
    agentPhotoUrl,
    agentEmail: (parsedJson.agentEmail ?? "").trim(),
    agentPhone: (parsedJson.agentPhone ?? "").trim(),
    inspectionDates,
    auctionDate,
    auctionTime,
    auctionVenue,
  };
}

export async function extractListingFromUrl(
  url: string,
): Promise<
  | { ok: true; data: ExtractedListingFields }
  | { ok: false; error: string }
> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a listing URL first." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn’t look like a valid URL." };
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return { ok: false, error: "Only http(s) URLs are supported." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "Anthropic is not configured. Add ANTHROPIC_API_KEY to autofill from URLs.",
    };
  }

  try {
    const fetched = await fetchListingPageContent(trimmed);
    if (!fetched.ok) {
      return { ok: false, error: fetched.error };
    }

    const host = parsed.hostname.toLowerCase();
    const franchiseHint =
      host.includes("raywhite") || host.includes("ljhooker")
        ? "\n\nThis listing URL is on Ray White or LJ Hooker — follow the system instructions for labelled Beds/Baths/Car fields, image URLs in the text, and suburb (property location, not office branch)."
        : "";

    const userContent =
      fetched.format === "html"
        ? `Listing URL: ${trimmed}\n\nHTML (truncated):\n${fetched.payload}${franchiseHint}${USER_OUTPUT_REMINDER}`
        : `Listing URL: ${trimmed}\n\nThe following is the full readable text extracted from the listing page (e.g. via a reader). Use all of it to fill every JSON field, including notesSummary and agent details.\n\n${fetched.payload}${franchiseHint}${USER_OUTPUT_REMINDER}`;

    let raw: string | null;
    try {
      const anthropic = getAnthropic();
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const messageText =
        textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
      console.log("[extract] model raw response:", messageText);
      raw = messageText || null;
    } catch (error: unknown) {
      const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
      console.error(
        "[extractListingFromUrl] ANTHROPIC_API_KEY is set:",
        hasApiKey,
      );

      const messageText =
        error instanceof Error ? error.message : String(error);
      console.error(
        "[extractListingFromUrl] Anthropic API error message:",
        messageText,
      );
      console.error("[extractListingFromUrl] Anthropic API error full:", error);

      const isAuth =
        error instanceof AuthenticationError ||
        (error instanceof APIError && error.status === 401);
      if (isAuth) {
        return { ok: false, error: "Invalid API key" };
      }

      const isRateLimited =
        error instanceof RateLimitError ||
        (error instanceof APIError && error.status === 429);
      if (isRateLimited) {
        return { ok: false, error: "Rate limited, try again" };
      }

      return {
        ok: false,
        error:
          messageText.trim() ||
          "AI extraction failed. Check ANTHROPIC_API_KEY or fill the form manually.",
      };
    }

    const htmlImages = extractImageUrlsFromHtml(
      fetched.payload,
      trimmed,
      8,
    );
    const scrapedCombined = dedupeImageUrls(
      [...htmlImages.urls, ...extractImageUrlsFromPlainText(fetched.payload, trimmed, 8)],
      8,
    );

    const heuristics = extractListingStatsHeuristics(fetched.payload);

    if (!raw) {
      const parsedJson = mergeHeuristicsIntoParsed({}, heuristics);
      return {
        ok: true,
        data: listingJsonToFields(parsedJson, trimmed, scrapedCombined),
      };
    }

    const parsedJson = mergeHeuristicsIntoParsed(
      parseListingExtractJson(raw),
      heuristics,
    );
    return {
      ok: true,
      data: listingJsonToFields(parsedJson, trimmed, scrapedCombined),
    };
  } catch (e) {
    console.error("[extractListingFromUrl] unexpected error:", e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Listing extraction failed unexpectedly.",
    };
  }
}
