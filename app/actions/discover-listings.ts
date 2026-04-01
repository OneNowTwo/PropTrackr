"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { extractListingFromUrl } from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";
import { extractListingHitsFromPage } from "@/lib/discovery/agency-listing-extract";
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
import { preferenceTokenToContext } from "@/lib/suburb-preferences";

const MAX_NEW_PER_RUN = 8;
const MAX_HITS_PER_AGENCY_PAGE = 24;
const DISCOVER_TOTAL_MS = 120_000;

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

  const { userId: clerkUserIdFromAuth } = await auth();
  console.log("[discoverNewListings] inserts use internal user row:", {
    internalUserId: dbUser.id,
    clerkIdOnUserRow: dbUser.clerkId,
    clerkUserIdFromAuth,
    idsAligned: clerkUserIdFromAuth === dbUser.clerkId,
  });

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

  /** Counts each Claude hit we iterate (inner loop), including skips. */
  let processedCount = 0;
  /** Only incremented when `insert...returning` returns a row (real DB insert). */
  let added = 0;
  let aborted = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => {
      aborted = true;
      console.log("[discover] timeout reached, returning partial results");
      resolve("timeout");
    }, DISCOVER_TOTAL_MS);
  });

  const workPromise = (async () => {
    try {
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
        if (aborted) break;
        if (suburbsWithAgencies.has(suburb)) continue;
        console.log(
          "[discoverNewListings] no suburb_agency_urls yet for preference token; running inline discover:",
          suburb,
        );
        const res = await discoverAndPersistAgencyUrlsForSuburb(
          dbUser.id,
          suburb,
        );
        console.log(
          "[discoverNewListings] inline agency discover result:",
          suburb,
          res,
        );
        if (res.ok && res.count > 0) {
          suburbsWithAgencies.add(suburb);
        }
      }

      if (aborted) return;

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

      console.log(
        "[discover] agency URLs found:",
        agencyRows.length,
        agencyRows.map((a) => a.agencyUrl),
      );
      console.log(
        "[discoverNewListings] proceeding to Jina listing scrape with",
        agencyRows.length,
        "agency URL(s)",
      );

      for (const agencyRow of agencyRows) {
        if (aborted || added >= MAX_NEW_PER_RUN) break;

        const agencyUrl = agencyRow.agencyUrl;
        const page = await fetchPageViaJina(agencyUrl);
        const ctx = preferenceTokenToContext(agencyRow.suburb);
        const suburbLabel = ctx.suburb
          ? ctx.postcode
            ? `${ctx.suburb} ${ctx.postcode} ${ctx.state}`
            : `${ctx.suburb}, ${ctx.state}`
          : agencyRow.suburb;

        console.log(
          "[discover] fetch result for",
          agencyUrl,
          "- ok:",
          page.ok,
          "- text chars:",
          page.text.length,
          "- link count:",
          page.ok ? page.links.length : 0,
        );

        const hits = page.ok
          ? await extractListingHitsFromPage(page.links, suburbLabel)
          : [];

        console.log(
          "[discover] claude extracted hits:",
          hits.length,
          JSON.stringify(hits.slice(0, 2)),
        );

        await db
          .update(suburbAgencyUrls)
          .set({ lastScrapedAt: new Date() })
          .where(eq(suburbAgencyUrls.id, agencyRow.id));

        if (!hits.length) continue;

        for (const hit of hits.slice(0, MAX_HITS_PER_AGENCY_PAGE)) {
          if (aborted || added >= MAX_NEW_PER_RUN) break;
          processedCount += 1;

          const listingUrl = hit.listingUrl
            ? normalizeListingUrl(String(hit.listingUrl))
            : null;
          if (!listingUrl) {
            console.log(
              "[discover] hit listingUrl:",
              hit.listingUrl,
              "- skip: invalid URL",
            );
            continue;
          }

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
          const alreadyExists = Boolean(existing);
          console.log(
            "[discover] hit listingUrl:",
            listingUrl,
            "- already exists:",
            alreadyExists,
          );
          if (existing) continue;

          if (aborted) break;

          const extracted = await extractListingFromUrl(listingUrl);
          const full = extracted.ok ? extracted.data : null;

          const address = (full?.address || hit.address || "").trim();
          const suburb = (full?.suburb || hit.suburb || "").trim();
          console.log("[discover] extracted listing:", {
            address,
            suburb,
            ok: extracted.ok,
          });
          if (!address || !suburb) {
            console.log(
              "[discover] skip hit: missing address or suburb after extract",
              { listingUrl },
            );
            continue;
          }

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

            if (row) {
              added += 1;
              console.log("[discover] inserted discovered property:", listingUrl);
            } else {
              console.log(
                "[discover] insert produced no row (conflict or DB noop):",
                listingUrl,
              );
            }
          } catch (e) {
            console.error("[discover-listings] insert error:", e);
          }
        }
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  })();

  await Promise.race([workPromise, timeoutPromise]);

  console.log("[discover] run complete - added:", added, "processed:", processedCount);

  revalidatePath("/dashboard", "page");
  revalidatePath("/dashboard");
  /** `added` = rows returned from insert…returning only (actual new inserts), not Claude hit count. */
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
