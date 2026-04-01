"use server";

import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import {
  extractListingFromUrl,
  fetchViaJinaReader,
} from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";
import { getAnthropic } from "@/lib/anthropic";
import {
  buildDomainSearchUrl,
  buildRealestateSearchUrl,
  DEFAULT_DISCOVERY_PROPERTY_TYPES,
} from "@/lib/discovery/search-urls";
import { getDb } from "@/lib/db";
import { discoveredProperties, searchPreferences } from "@/lib/db/schema";
import { isValidPropertyId } from "@/lib/db/queries";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { normalizePropertyTypeForDb } from "@/lib/listing/normalize";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_NEW_PER_RUN = 8;
const MAX_EXTRACT_PER_PAGE = 10;

function pickInt(
  fromFull: number | null,
  fromHit: number | null | undefined,
): number | null {
  if (fromFull != null && Number.isFinite(fromFull)) return fromFull;
  if (fromHit != null && Number.isFinite(fromHit)) return Math.round(fromHit);
  return null;
}

type SearchHit = {
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  propertyType?: string | null;
  listingUrl?: string | null;
  imageUrl?: string | null;
};

function normalizeListingUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function parseSearchResultsJson(raw: string): SearchHit[] {
  let candidate = raw.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) candidate = fence[1].trim();
  try {
    const v = JSON.parse(candidate) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && typeof x === "object") as SearchHit[];
  } catch {
    return [];
  }
}

async function extractListingsFromSearchPage(
  pageText: string,
  sourceUrl: string,
): Promise<SearchHit[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const prompt = `Extract up to ${MAX_EXTRACT_PER_PAGE} individual property listings from this real estate search results page. For each listing extract: address, suburb, price, bedrooms, bathrooms, parking, propertyType, listingUrl, imageUrl.

Return as a JSON array only (no markdown fences): [{"address","suburb","state","postcode","price","bedrooms","bathrooms","parkingSpaces","propertyType","listingUrl","imageUrl"}]

Rules:
- Only include listings with a valid absolute http(s) listingUrl.
- price: number in AUD (whole dollars) or null.
- bedrooms, bathrooms, parkingSpaces: numbers or null.
- propertyType: short label e.g. House, Apartment, Townhouse, Unit, Land.
- Return [] if none found.

Source page URL (for context): ${sourceUrl}

Page content:
${pageText.slice(0, 100_000)}`;

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
    return parseSearchResultsJson(text);
  } catch (error: unknown) {
    console.error("[discover-listings] Claude search extract error:", error);
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

async function requireDbUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  return getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
}

export type DiscoverResult =
  | { ok: true; added: number }
  | { ok: false; error: string };

export async function discoverNewListings(): Promise<DiscoverResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const [prefs] = await db
    .select()
    .from(searchPreferences)
    .where(eq(searchPreferences.userId, dbUser.id))
    .limit(1);

  if (!prefs || prefs.suburbs.length === 0) {
    return { ok: true, added: 0 };
  }

  const types =
    prefs.propertyTypes.length > 0
      ? prefs.propertyTypes
      : [...DEFAULT_DISCOVERY_PROPERTY_TYPES];

  const minP = prefs.minPrice ?? 0;
  const maxP = prefs.maxPrice ?? 200_000_000;

  const urls: string[] = [];
  for (const suburb of prefs.suburbs) {
    for (const pt of types) {
      urls.push(buildDomainSearchUrl(suburb, pt, minP, maxP));
    }
    urls.push(buildRealestateSearchUrl(suburb));
  }

  let added = 0;

  for (const searchUrl of urls) {
    if (added >= MAX_NEW_PER_RUN) break;

    const jina = await fetchViaJinaReader(searchUrl);
    if (!jina.ok) continue;

    const hits = await extractListingsFromSearchPage(jina.body, searchUrl);
    if (!hits.length) continue;

    for (const hit of hits) {
      if (added >= MAX_NEW_PER_RUN) break;

      const listingUrl = hit.listingUrl
        ? normalizeListingUrl(String(hit.listingUrl))
        : null;
      if (!listingUrl) continue;

      const [existing] = await db
        .select({ id: discoveredProperties.id })
        .from(discoveredProperties)
        .where(
          and(
            eq(discoveredProperties.userId, dbUser.id),
            eq(discoveredProperties.listingUrl, listingUrl),
          ),
        )
        .limit(1);
      if (existing) continue;

      const extracted = await extractListingFromUrl(listingUrl);
      const full = extracted.ok ? extracted.data : null;

      const address = (
        full?.address ||
        hit.address ||
        ""
      ).trim();
      const suburb = (full?.suburb || hit.suburb || "").trim();
      if (!address || !suburb) continue;

      const state = (full?.state || hit.state || "").trim();
      const postcode = (full?.postcode || hit.postcode || "").trim();

      const fromFullPrice =
        full?.price != null && full.price !== ""
          ? Number.parseInt(full.price, 10)
          : NaN;
      const priceRaw = Number.isFinite(fromFullPrice)
        ? fromFullPrice
        : hit.price ?? null;
      const price =
        priceRaw != null && Number.isFinite(priceRaw)
          ? Math.round(priceRaw)
          : null;

      const bedrooms = pickInt(
        full?.bedrooms != null && full.bedrooms !== ""
          ? Number.parseInt(full.bedrooms, 10)
          : null,
        hit.bedrooms,
      );
      const bathrooms = pickInt(
        full?.bathrooms != null && full.bathrooms !== ""
          ? Number.parseInt(full.bathrooms, 10)
          : null,
        hit.bathrooms,
      );
      const parkingSpaces = pickInt(
        full?.parking != null && full.parking !== ""
          ? Number.parseInt(full.parking, 10)
          : null,
        hit.parkingSpaces,
      );

      const propertyTypeRaw = full?.propertyType || hit.propertyType || "";
      const propertyType = propertyTypeRaw.trim()
        ? normalizePropertyTypeForDb(propertyTypeRaw)
        : null;

      const imageUrl = (
        full?.imageUrl ||
        (hit.imageUrl ? String(hit.imageUrl) : "")
      ).trim();
      const imageUrls = full?.imageUrls?.length ? full.imageUrls : [];

      const notes = (full?.notes || "").trim();
      const agentName = (full?.agentName || "").trim() || null;
      const agencyName = (full?.agencyName || "").trim() || null;

      const title = `${address}, ${suburb}`;

      try {
        const [row] = await db
          .insert(discoveredProperties)
          .values({
            userId: dbUser.id,
            title,
            address,
            suburb,
            state,
            postcode,
            price,
            bedrooms,
            bathrooms,
            parkingSpaces,
            propertyType,
            imageUrl: imageUrl || null,
            imageUrls: imageUrls.length > 0 ? imageUrls : null,
            listingUrl,
            notes,
            agentName,
            agencyName,
            status: "pending",
            scrapedAt: new Date(),
          })
          .onConflictDoNothing({
            target: [discoveredProperties.userId, discoveredProperties.listingUrl],
          })
          .returning({ id: discoveredProperties.id });

        if (row) added += 1;
      } catch (e) {
        console.error("[discover-listings] insert error:", e);
      }
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, added };
}

export type MutationResult = { ok: true } | { ok: false; error: string };

export type SaveDiscoveredResult =
  | { ok: true; propertyId: string }
  | { ok: false; error: string };

export async function saveDiscoveredProperty(
  discoveredId: string,
): Promise<SaveDiscoveredResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(discoveredId)) {
    return { ok: false, error: "Invalid listing." };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(discoveredProperties)
    .where(
      and(
        eq(discoveredProperties.id, discoveredId),
        eq(discoveredProperties.userId, dbUser.id),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, error: "Listing not found." };
  if (row.status === "saved") {
    return { ok: false, error: "Already saved." };
  }
  if (row.status === "not_interested") {
    return { ok: false, error: "Listing was dismissed." };
  }

  const imageExtras = (row.imageUrls ?? []).filter((u) => u && u !== row.imageUrl);

  const created = await createPropertyRecordForUser({
    address: row.address,
    suburb: row.suburb,
    state: row.state,
    postcode: row.postcode,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parkingSpaces,
    propertyType: row.propertyType,
    listingUrl: row.listingUrl,
    imageUrl: row.imageUrl,
    imageUrls: imageExtras.length > 0 ? imageExtras : null,
    notes: row.notes || null,
    agentName: row.agentName,
    agencyName: row.agencyName,
    propertyStatus: "saved",
  });

  if (!created.ok) return { ok: false, error: created.error };

  await db
    .update(discoveredProperties)
    .set({ status: "saved" })
    .where(eq(discoveredProperties.id, discoveredId));

  revalidatePath("/dashboard");
  return { ok: true, propertyId: created.id };
}

export async function markMaybe(discoveredId: string): Promise<MutationResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(discoveredId)) {
    return { ok: false, error: "Invalid listing." };
  }

  const db = getDb();
  const updated = await db
    .update(discoveredProperties)
    .set({ status: "maybe" })
    .where(
      and(
        eq(discoveredProperties.id, discoveredId),
        eq(discoveredProperties.userId, dbUser.id),
      ),
    )
    .returning({ id: discoveredProperties.id });

  if (!updated.length) return { ok: false, error: "Listing not found." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markNotInterested(
  discoveredId: string,
): Promise<MutationResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(discoveredId)) {
    return { ok: false, error: "Invalid listing." };
  }

  const db = getDb();
  const updated = await db
    .update(discoveredProperties)
    .set({ status: "not_interested" })
    .where(
      and(
        eq(discoveredProperties.id, discoveredId),
        eq(discoveredProperties.userId, dbUser.id),
      ),
    )
    .returning({ id: discoveredProperties.id });

  if (!updated.length) return { ok: false, error: "Listing not found." };
  revalidatePath("/dashboard");
  return { ok: true };
}
