"use server";

import { getAnthropic } from "@/lib/anthropic";
import {
  normalizeAustralianState,
  normalizePropertyTypeForDb,
} from "@/lib/listing/normalize";

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
};

function stripHeavyMarkup(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .slice(0, MAX_HTML_CHARS);
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
  primaryImageUrl?: string | null;
};

const SYSTEM_PROMPT = `You extract Australian residential property listing details from page content (HTML or plain text from a reader). Extract whatever you can; use null for unknown fields.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly these keys:
address: string|null — street line without suburb/state/postcode when possible
suburb: string|null
state: string|null — NSW, VIC, QLD, SA, WA, TAS, ACT, or NT
postcode: string|null
price: number|null — main advertised sale price in whole AUD (not weekly rent unless only rent is shown)
bedrooms: number|null
bathrooms: number|null
parkingSpaces: number|null — car spaces / parking
propertyType: string|null — House, Apartment, Townhouse, Unit, Land, or Other
primaryImageUrl: string|null — absolute https URL for the main listing photo if present

Ignore bond amounts. Prefer the primary listing price. Partial data is fine — output null for anything you cannot infer.`;

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

async function fetchViaJinaReader(
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

  const body = await res.text();
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
function parseClaudeListingJson(raw: string): ListingExtractJson {
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

function listingJsonToFields(
  parsedJson: ListingExtractJson,
  listingUrl: string,
): ExtractedListingFields {
  const state = normalizeAustralianState(parsedJson.state ?? undefined);
  const propertyType =
    normalizePropertyTypeForDb(parsedJson.propertyType ?? undefined) ?? "";

  const n = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? String(Math.round(v)) : "";

  let imageUrl = (parsedJson.primaryImageUrl ?? "").trim();
  if (imageUrl) {
    try {
      const img = new URL(imageUrl, listingUrl);
      if (img.protocol === "http:" || img.protocol === "https:") {
        imageUrl = img.href;
      } else {
        imageUrl = "";
      }
    } catch {
      imageUrl = "";
    }
  }

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

  const fetched = await fetchListingPageContent(trimmed);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const userContent =
    fetched.format === "html"
      ? `Listing URL: ${trimmed}\n\nHTML (truncated):\n${fetched.payload}`
      : `Listing URL: ${trimmed}\n\nThe following is readable text extracted from the listing page (may omit some markup). Extract property details from it.\n\n${fetched.payload}`;

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
    raw =
      textBlock && textBlock.type === "text"
        ? textBlock.text.trim()
        : null;
  } catch {
    return {
      ok: false,
      error:
        "AI extraction failed. Check ANTHROPIC_API_KEY or fill the form manually.",
    };
  }

  if (!raw) {
    return {
      ok: true,
      data: listingJsonToFields({}, trimmed),
    };
  }

  const parsedJson = parseClaudeListingJson(raw);
  return {
    ok: true,
    data: listingJsonToFields(parsedJson, trimmed),
  };
}
