"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { extractListingFromUrl } from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";
import { extractAgencyPageListingHits } from "@/lib/discovery/agency-listing-extract";
import { discoverAndPersistAgencyUrlsForSuburb } from "@/lib/discovery/find-agency-urls";
import { fetchPageViaJina } from "@/lib/discovery/jina";
import { getDb } from "@/lib/db";
import { isValidPropertyId } from "@/lib/db/queries";
import {
  discoveredProperties,
  searchPreferences,
  suburbAgencyUrls,
} from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { normalizePropertyTypeForDb } from "@/lib/listing/normalize";

const MAX_NEW_PER_RUN = 8;
const MAX_HITS_PER_AGENCY_PAGE = 24;

function pickInt(
  fromFull: number | null,
  fromHit: number | null | undefined,
): number | null {
  if (fromFull != null && Number.isFinite(fromFull)) return fromFull;
  if (fromHit != null && Number.isFinite(fromHit)) return Math.round(fromHit);
  return null;
}

function normalizeListingUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    return null;
  } catch {
    return null;
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

  const suburbList = prefs.suburbs.map((s) => s.trim()).filter(Boolean);
  if (suburbList.length === 0) {
    return { ok: true, added: 0 };
  }

  const existingAgency = await db
    .select({ suburb: suburbAgencyUrls.suburb })
    .from(suburbAgencyUrls)
    .where(
      and(
        eq(suburbAgencyUrls.userId, dbUser.id),
        inArray(suburbAgencyUrls.suburb, suburbList),
      ),
    );

  const suburbsWithAgencies = new Set(existingAgency.map((r) => r.suburb));

  for (const suburb of suburbList) {
    if (suburbsWithAgencies.has(suburb)) continue;
    const res = await discoverAndPersistAgencyUrlsForSuburb(dbUser.id, suburb);
    if (res.ok && res.count > 0) {
      suburbsWithAgencies.add(suburb);
    }
  }

  let agencyRows = await db
    .select()
    .from(suburbAgencyUrls)
    .where(
      and(
        eq(suburbAgencyUrls.userId, dbUser.id),
        inArray(suburbAgencyUrls.suburb, suburbList),
      ),
    );

  agencyRows = [...agencyRows].sort((a, b) => {
    const ta = a.lastScrapedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const tb = b.lastScrapedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return ta - tb;
  });

  let added = 0;

  for (const agencyRow of agencyRows) {
    if (added >= MAX_NEW_PER_RUN) break;

    const jina = await fetchPageViaJina(agencyRow.agencyUrl);
    const pageText = jina.ok ? jina.body : "";

    const hits = pageText
      ? await extractAgencyPageListingHits(pageText, agencyRow.agencyUrl)
      : [];

    await db
      .update(suburbAgencyUrls)
      .set({ lastScrapedAt: new Date() })
      .where(eq(suburbAgencyUrls.id, agencyRow.id));

    if (!hits.length) continue;

    for (const hit of hits.slice(0, MAX_HITS_PER_AGENCY_PAGE)) {
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

      const address = (full?.address || hit.address || "").trim();
      const suburb = (full?.suburb || hit.suburb || "").trim();
      if (!address || !suburb) continue;

      const state = (full?.state || "").trim();
      const postcode = (full?.postcode || "").trim();

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
        null,
      );

      const propertyTypeRaw = full?.propertyType || hit.propertyType || "";
      const propertyType = propertyTypeRaw.trim()
        ? normalizePropertyTypeForDb(propertyTypeRaw)
        : null;

      const imageUrl = (full?.imageUrl || "").trim();
      const imageUrls = full?.imageUrls?.length ? full.imageUrls : [];

      const notes = (full?.notes || "").trim();
      const agentName = (full?.agentName || "").trim() || null;
      const agencyName =
        (full?.agencyName || agencyRow.agencyName || "").trim() || null;

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
            target: [
              discoveredProperties.userId,
              discoveredProperties.listingUrl,
            ],
          })
          .returning({ id: discoveredProperties.id });

        if (row) added += 1;
      } catch (e) {
        console.error("[discover-listings] insert error:", e);
      }
    }
  }

  revalidatePath("/dashboard", "page");
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
