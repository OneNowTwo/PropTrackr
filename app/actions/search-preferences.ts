"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { discoverAndPersistAgencyUrlsForSuburb } from "@/lib/discovery/find-agency-urls";
import { getDb } from "@/lib/db";
import { searchPreferences } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { PROPERTY_TYPES } from "@/lib/property-form-constants";

export type SearchPreferencesResult =
  | { ok: true }
  | { ok: false; error: string };

function parseStringArray(raw: unknown, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    out.push(s.slice(0, 120));
    if (out.length >= maxLen) break;
  }
  return out;
}

export async function saveSearchPreferences(
  formData: FormData,
): Promise<SearchPreferencesResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "You must be signed in." };
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return { ok: false, error: "Your account needs an email address." };
  }

  let suburbsRaw: unknown;
  let typesRaw: unknown;
  try {
    suburbsRaw = JSON.parse(String(formData.get("suburbs") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid suburbs data." };
  }
  try {
    typesRaw = JSON.parse(String(formData.get("propertyTypes") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid property types data." };
  }

  const suburbs = parseStringArray(suburbsRaw, 40);
  const typeStrings = parseStringArray(typesRaw, 20);
  const propertyTypes = typeStrings.filter((t) =>
    (PROPERTY_TYPES as readonly string[]).includes(t),
  );

  const minRaw = String(formData.get("minPrice") ?? "").trim();
  const maxRaw = String(formData.get("maxPrice") ?? "").trim();
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  if (minRaw) {
    const n = Number.parseInt(minRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Min price must be a valid number." };
    }
    minPrice = n;
  }
  if (maxRaw) {
    const n = Number.parseInt(maxRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Max price must be a valid number." };
    }
    maxPrice = n;
  }
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { ok: false, error: "Min price cannot be greater than max price." };
  }

  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });

    const db = getDb();
    const [previousPrefs] = await db
      .select({ suburbs: searchPreferences.suburbs })
      .from(searchPreferences)
      .where(eq(searchPreferences.userId, dbUser.id))
      .limit(1);
    const prevSuburbSet = new Set(previousPrefs?.suburbs ?? []);

    const [upserted] = await db
      .insert(searchPreferences)
      .values({
        userId: dbUser.id,
        suburbs,
        minPrice,
        maxPrice,
        propertyTypes,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: searchPreferences.userId,
        set: {
          suburbs,
          minPrice,
          maxPrice,
          propertyTypes,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: searchPreferences.id,
        userId: searchPreferences.userId,
        suburbs: searchPreferences.suburbs,
        propertyTypes: searchPreferences.propertyTypes,
        updatedAt: searchPreferences.updatedAt,
      });

    console.log("[saveSearchPreferences] upsert result:", {
      row: upserted ?? null,
      suburbCount: upserted?.suburbs?.length ?? 0,
    });

    const newSuburbs = suburbs.filter((s) => !prevSuburbSet.has(s));
    if (newSuburbs.length > 0) {
      for (const s of newSuburbs) {
        void discoverAndPersistAgencyUrlsForSuburb(dbUser.id, s).catch(
          (err) => {
            console.error(
              "[saveSearchPreferences] agency discovery failed for",
              s,
              err,
            );
          },
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save preferences.";
    return { ok: false, error: msg };
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true };
}
