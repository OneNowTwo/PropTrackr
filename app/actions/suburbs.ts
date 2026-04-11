"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { followedSuburbs, properties, users } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { auth, currentUser } from "@clerk/nextjs/server";

export type FollowedSuburbRow = {
  id: string;
  suburb: string;
  state: string;
  postcode: string;
  propertyCount: number;
  createdAt: Date;
};

/** Same as getFollowedSuburbs but uses the DB user id (no auth — safe inside parallel server work). */
export async function getFollowedSuburbsForDbUser(
  dbUserId: string,
): Promise<FollowedSuburbRow[]> {
  if (!dbUserId || !process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: followedSuburbs.id,
        suburb: followedSuburbs.suburb,
        state: followedSuburbs.state,
        postcode: followedSuburbs.postcode,
        createdAt: followedSuburbs.createdAt,
      })
      .from(followedSuburbs)
      .where(eq(followedSuburbs.userId, dbUserId))
      .orderBy(followedSuburbs.suburb);

    const propCounts = await db
      .select({
        suburb: properties.suburb,
        postcode: properties.postcode,
        cnt: count(),
      })
      .from(properties)
      .where(eq(properties.userId, dbUserId))
      .groupBy(properties.suburb, properties.postcode);

    const countMap = new Map<string, number>();
    for (const r of propCounts) {
      countMap.set(`${r.suburb}|${r.postcode}`, Number(r.cnt));
    }

    return rows.map((r) => ({
      ...r,
      propertyCount: countMap.get(`${r.suburb}|${r.postcode}`) ?? 0,
    }));
  } catch (e) {
    console.error("[suburbs] getFollowedSuburbsForDbUser error:", e);
    return [];
  }
}

export async function getFollowedSuburbs(): Promise<FollowedSuburbRow[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const [ur] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!ur) return [];
    return getFollowedSuburbsForDbUser(ur.id);
  } catch (e) {
    console.error("[suburbs] getFollowedSuburbs error:", e);
    return [];
  }
}

export async function followSuburb(
  suburb: string,
  state: string,
  postcode: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "Not signed in." };
  if (!process.env.DATABASE_URL) return { ok: false, error: "No DB." };

  const trimmedSuburb = suburb.trim();
  const trimmedState = state.trim() || "NSW";
  const trimmedPostcode = postcode.trim();
  if (!trimmedSuburb || !trimmedPostcode)
    return { ok: false, error: "Suburb and postcode are required." };

  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
    const dbUser = await getOrCreateUserByClerkId({
      clerkId,
      email,
      name: clerkUser?.fullName ?? null,
    });

    const db = getDb();
    await db
      .insert(followedSuburbs)
      .values({
        userId: dbUser.id,
        suburb: trimmedSuburb,
        state: trimmedState,
        postcode: trimmedPostcode,
      })
      .onConflictDoNothing();

    revalidatePath("/suburbs");
    return { ok: true };
  } catch (e) {
    console.error("[suburbs] followSuburb error:", e);
    return { ok: false, error: "Could not follow suburb." };
  }
}

export async function unfollowSuburb(
  suburbId: string,
): Promise<{ ok: boolean }> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return { ok: false };

  try {
    const db = getDb();
    const [ur] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!ur) return { ok: false };

    await db
      .delete(followedSuburbs)
      .where(
        and(
          eq(followedSuburbs.id, suburbId),
          eq(followedSuburbs.userId, ur.id),
        ),
      );

    revalidatePath("/suburbs");
    return { ok: true };
  } catch (e) {
    console.error("[suburbs] unfollowSuburb error:", e);
    return { ok: false };
  }
}

export async function getSuburbProperties(
  suburb: string,
  postcode: string,
) {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const [ur] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!ur) return [];

    return db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.userId, ur.id),
          eq(properties.suburb, suburb),
          eq(properties.postcode, postcode),
        ),
      );
  } catch (e) {
    console.error("[suburbs] getSuburbProperties error:", e);
    return [];
  }
}

/** Upsert a followed_suburb row — called after property creation. */
export async function ensureSuburbFollowed(
  dbUserId: string,
  suburb: string,
  state: string,
  postcode: string,
): Promise<void> {
  if (!suburb.trim() || !postcode.trim()) return;
  console.log("[suburb] ensuring suburb followed:", suburb, postcode);
  try {
    const db = getDb();
    await db
      .insert(followedSuburbs)
      .values({
        userId: dbUserId,
        suburb: suburb.trim(),
        state: state.trim() || "NSW",
        postcode: postcode.trim(),
      })
      .onConflictDoNothing();
  } catch (e) {
    console.warn("[suburbs] ensureSuburbFollowed error:", e);
  }
}
