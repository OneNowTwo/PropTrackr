import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { getAnthropic } from "@/lib/anthropic";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_PAGE_CHARS = 100_000;

export type AgencyListingHit = {
  listingUrl: string;
  address?: string | null;
  suburb?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
};

function parseListingHitsJson(raw: string): AgencyListingHit[] {
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) candidate = fence[1].trim();
  try {
    const v = JSON.parse(candidate) as unknown;
    if (!Array.isArray(v)) return [];
    const out: AgencyListingHit[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const listingUrl = String(o.listingUrl ?? "").trim();
      if (!listingUrl) continue;
      out.push({
        listingUrl,
        address: o.address != null ? String(o.address) : null,
        suburb: o.suburb != null ? String(o.suburb) : null,
        price:
          typeof o.price === "number" && Number.isFinite(o.price)
            ? o.price
            : null,
        bedrooms:
          typeof o.bedrooms === "number" && Number.isFinite(o.bedrooms)
            ? Math.round(o.bedrooms)
            : null,
        bathrooms:
          typeof o.bathrooms === "number" && Number.isFinite(o.bathrooms)
            ? Math.round(o.bathrooms)
            : null,
        propertyType:
          o.propertyType != null ? String(o.propertyType) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function extractAgencyPageListingHits(
  pageText: string,
  sourceAgencyUrl: string,
): Promise<AgencyListingHit[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const prompt = `Extract all individual property listing URLs from this real estate agency search page. Return as JSON array of objects: 
[{listingUrl, address, suburb, price, bedrooms, bathrooms, propertyType}]
Only include URLs that go to individual property detail pages (not search pages). Return [] if none found.

Source page URL (for context): ${sourceAgencyUrl}

Page content:
${pageText.slice(0, MAX_PAGE_CHARS)}`;

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
    return parseListingHitsJson(text);
  } catch (error: unknown) {
    console.error("[agency-listing-extract] Claude error:", error);
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
