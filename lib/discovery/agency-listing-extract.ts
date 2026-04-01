import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { getAnthropic } from "@/lib/anthropic";
import type { ApifyPageLink } from "@/lib/discovery/types";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_LISTING_HITS = 10;

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
      if (out.length >= MAX_LISTING_HITS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Classify Apify-extracted anchor links into property listing URLs via Claude.
 */
export async function extractListingHitsFromPage(
  links: ApifyPageLink[],
  suburbLabel: string,
): Promise<AgencyListingHit[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  if (links.length === 0) return [];

  const prompt = `Here are links extracted from a real estate agency search page for ${suburbLabel}. Identify which are individual property listing pages (not search/filter/contact pages). For each listing link, extract address and suburb from the URL or link text if possible.

Links: ${JSON.stringify(links)}

Return JSON array: [{listingUrl, address, suburb, price, bedrooms, bathrooms, propertyType}] with null for unknown fields.
Only include links that go to individual property detail pages.
Return [] if none found.`;

  console.log(
    "[extract-hits] links sent to Claude:",
    JSON.stringify(links.slice(0, 10), null, 2),
  );

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const rawText =
      textBlock && textBlock.type === "text" ? textBlock.text : "";
    console.log("[extract-hits] Claude raw response:", rawText);
    return parseListingHitsJson(rawText);
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
