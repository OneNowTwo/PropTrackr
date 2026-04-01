"use server";

import { getAnthropic } from "@/lib/anthropic";
import {
  normalizeAustralianState,
  normalizePropertyTypeForDb,
} from "@/lib/listing/normalize";

const MAX_HTML_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

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

const SYSTEM_PROMPT = `You extract Australian residential real estate listing data from raw HTML (Domain, realestate.com.au, agent sites). Return ONLY valid JSON (no markdown, no explanation) with these keys (use null when unknown):
address: string|null — street address without suburb/state/postcode if possible
suburb: string|null
state: string|null — prefer 2-3 letter code NSW VIC QLD SA WA TAS ACT NT
postcode: string|null
price: number|null — whole AUD dollars for the main advertised sale price (not weekly rent unless only rent shown)
bedrooms: number|null
bathrooms: number|null
parkingSpaces: number|null — car spaces
propertyType: string|null — House, Apartment, Townhouse, Unit, Land, or Other
primaryImageUrl: string|null — absolute https URL for the main hero/og listing photo if present in the HTML

Ignore rental bond amounts. Prefer the primary listing price.`;

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

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(trimmed, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not load the page (HTTP ${res.status}). Try copying details manually.`,
      };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return {
        ok: false,
        error:
          "The URL did not return HTML. Open the listing in a browser and paste again.",
      };
    }
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("abort")) {
      return { ok: false, error: "The page took too long to load. Try again." };
    }
    return {
      ok: false,
      error:
        "Could not fetch that URL. Some sites block automated access — fill the form manually.",
    };
  }

  const snippet = stripHeavyMarkup(html);

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
          content: `Listing URL: ${trimmed}\n\nHTML (truncated):\n${snippet}`,
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
    return { ok: false, error: "Could not read the listing. Try again." };
  }

  let parsedJson: ListingExtractJson;
  try {
    parsedJson = JSON.parse(raw) as ListingExtractJson;
  } catch {
    return { ok: false, error: "Could not parse listing data. Try again." };
  }

  const state = normalizeAustralianState(parsedJson.state ?? undefined);
  const propertyType =
    normalizePropertyTypeForDb(parsedJson.propertyType ?? undefined) ?? "";

  const n = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? String(Math.round(v)) : "";

  let imageUrl = (parsedJson.primaryImageUrl ?? "").trim();
  if (imageUrl) {
    try {
      const img = new URL(imageUrl, trimmed);
      if (img.protocol === "http:" || img.protocol === "https:") {
        imageUrl = img.href;
      } else {
        imageUrl = "";
      }
    } catch {
      imageUrl = "";
    }
  }

  const data: ExtractedListingFields = {
    address: (parsedJson.address ?? "").trim(),
    suburb: (parsedJson.suburb ?? "").trim(),
    state,
    postcode: (parsedJson.postcode ?? "").trim(),
    price: n(parsedJson.price),
    bedrooms: n(parsedJson.bedrooms),
    bathrooms: n(parsedJson.bathrooms),
    parking: n(parsedJson.parkingSpaces),
    propertyType,
    listingUrl: trimmed,
    imageUrl,
  };

  return { ok: true, data };
}
