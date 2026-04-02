"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { extractListingFromUrl } from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";
import { discoverAndPersistAgencyUrlsForSuburb } from "@/lib/discovery/find-agency-urls";
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
const DISCOVER_TOTAL_MS = 120_000;

function normalizeSuburbKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function pickInt(fromFull: number | null): number | null {
  if (fromFull != null && Number.isFinite(fromFull)) return fromFull;
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

  let processedCount = 0;
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

      const suburbsWithSeeds = new Set(existingAgency.map((r) => r.suburb));

      for (const suburb of suburbList) {
        if (aborted) break;
        if (suburbsWithSeeds.has(suburb)) continue;
        console.log(
          "[discoverNewListings] no listing seeds for token; Google+Jina discover:",
          suburb,
        );
        const res = await discoverAndPersistAgencyUrlsForSuburb(
          dbUser.id,
          suburb,
        );
        console.log(
          "[discoverNewListings] listing URL discover result:",
          suburb,
          res,
        );
        if (res.ok && res.count > 0) {
          suburbsWithSeeds.add(suburb);
        }
      }

      if (aborted) return;

      let seedRows = await db
        .select()
        .from(suburbAgencyUrls)
        .where(
          and(
            eq(suburbAgencyUrls.userId, dbUser.id),
            inArray(suburbAgencyUrls.suburb, suburbList),
          ),
        );

      seedRows = [...seedRows].sort((a, b) => {
        const ta = a.lastScrapedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        const tb = b.lastScrapedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
        return ta - tb;
      });

      console.log(
        "[discover] listing URL seeds:",
        seedRows.length,
        seedRows.map((r) => r.agencyUrl).slice(0, 5),
      );

      for (const seedRow of seedRows) {
        if (aborted || added >= MAX_NEW_PER_RUN) break;
        processedCount += 1;

        const listingUrl = normalizeListingUrl(seedRow.agencyUrl);
        if (!listingUrl) {
          console.log("[discover] skip: invalid seed URL", seedRow.agencyUrl);
          continue;
        }

        const ctx = preferenceTokenToContext(seedRow.suburb);
        const preferenceSuburb = ctx.suburb.trim();
        const preferenceSuburbKey = normalizeSuburbKey(preferenceSuburb);
        if (!preferenceSuburbKey) {
          console.log(
            "[discover] skip seed: empty preference suburb in token",
            listingUrl,
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
        if (existing) {
          await db
            .update(suburbAgencyUrls)
            .set({ lastScrapedAt: new Date() })
            .where(eq(suburbAgencyUrls.id, seedRow.id));
          continue;
        }

        if (aborted) break;

        let extracted:
          | Awaited<ReturnType<typeof extractListingFromUrl>>
          | null = null;
        try {
          extracted = await extractListingFromUrl(listingUrl);
        } catch (e) {
          console.error(
            "[discover-listings] extractListingFromUrl threw:",
            listingUrl,
            e,
          );
          extracted = {
            ok: false,
            error:
              e instanceof Error ? e.message : "Listing extraction failed.",
          };
        }

        await db
          .update(suburbAgencyUrls)
          .set({ lastScrapedAt: new Date() })
          .where(eq(suburbAgencyUrls.id, seedRow.id));

        const full = extracted?.ok ? extracted.data : null;

        const extractedSuburbKey = normalizeSuburbKey(full?.suburb ?? "");
        if (!extractedSuburbKey || extractedSuburbKey !== preferenceSuburbKey) {
          console.log(
            "[discover] skip: suburb mismatch after extract — got:",
            extractedSuburbKey || "(empty)",
            "expected:",
            preferenceSuburbKey,
            listingUrl,
          );
          continue;
        }

        const address = (full?.address ?? "").trim();
        const suburbNorm = preferenceSuburb.trim();
        console.log("[discover] extracted listing:", {
          address,
          suburb: suburbNorm,
          ok: extracted?.ok,
        });
        if (!address) {
          console.log(
            "[discover] skip: missing address after extract",
            listingUrl,
          );
          continue;
        }

        const state = (full?.state || "").trim();
        const postcode = (full?.postcode || "").trim();

        const fromFullPrice =
          full?.price != null && full.price !== ""
            ? Number.parseInt(full.price, 10)
            : NaN;
        const price =
          Number.isFinite(fromFullPrice) ? Math.round(fromFullPrice) : null;

        const bedrooms = pickInt(
          full?.bedrooms != null && full.bedrooms !== ""
            ? Number.parseInt(full.bedrooms, 10)
            : null,
        );
        const bathrooms = pickInt(
          full?.bathrooms != null && full.bathrooms !== ""
            ? Number.parseInt(full.bathrooms, 10)
            : null,
        );
        const parkingSpaces = pickInt(
          full?.parking != null && full.parking !== ""
            ? Number.parseInt(full.parking, 10)
            : null,
        );

        const propertyTypeRaw = full?.propertyType || "";
        const propertyType = propertyTypeRaw.trim()
          ? normalizePropertyTypeForDb(propertyTypeRaw)
          : null;

        const imageUrl = (full?.imageUrl ?? "").trim();
        const imageUrls = Array.isArray(full?.imageUrls) ? full.imageUrls : [];

        const notes = (full?.notes || "").trim();
        const agentName = (full?.agentName || "").trim() || null;
        const agencyName =
          (full?.agencyName || seedRow.agencyName || "").trim() || null;

        const title = `${address}, ${suburbNorm}`;

        console.log("[discover] inserting:", {
          address,
          suburb: suburbNorm,
          imageUrl: imageUrl || null,
          imageUrls: imageUrls.length > 0 ? imageUrls : null,
        });

        try {
          const [row] = await db
            .insert(discoveredProperties)
            .values({
              userId: dbUser.id,
              title,
              address,
              suburb: suburbNorm,
              state,
              postcode,
              price,
              bedrooms,
              bathrooms,
              parkingSpaces,
              propertyType,
              imageUrl: imageUrl ? imageUrl : null,
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
          }
        } catch (e) {
          console.error("[discover-listings] insert error:", e);
        }
      }
    } catch (e) {
      console.error("[discover-listings] run aborted by error:", e);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  })();

  await Promise.race([workPromise, timeoutPromise]);

  console.log("[discover] run complete - added:", added, "processed:", processedCount);

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
