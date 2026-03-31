import { and, count, desc, eq, gte } from "drizzle-orm";

import { getDb } from "./index";
import { inspections, properties, users } from "./schema";

const PROPERTY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPropertyId(id: string): boolean {
  return PROPERTY_UUID_RE.test(id);
}

export type DashboardStats = {
  totalProperties: number;
  upcomingInspections: number;
  shortlisted: number;
  inspectionsAttended: number;
};

export const emptyDashboardStats: DashboardStats = {
  totalProperties: 0,
  upcomingInspections: 0,
  shortlisted: 0,
  inspectionsAttended: 0,
};

export async function getDashboardData(clerkUserId: string | undefined) {
  if (!clerkUserId || !process.env.DATABASE_URL) {
    return {
      stats: emptyDashboardStats,
      recent: [] as (typeof properties.$inferSelect)[],
    };
  }

  const db = getDb();

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!userRow) {
    return { stats: emptyDashboardStats, recent: [] };
  }

  const userId = userRow.id;
  const now = new Date();

  const [totalRow] = await db
    .select({ c: count() })
    .from(properties)
    .where(eq(properties.userId, userId));

  const [shortlistedRow] = await db
    .select({ c: count() })
    .from(properties)
    .where(
      and(
        eq(properties.userId, userId),
        eq(properties.status, "shortlisted"),
      ),
    );

  const [upcomingRow] = await db
    .select({ c: count() })
    .from(inspections)
    .where(
      and(
        eq(inspections.userId, userId),
        gte(inspections.inspectionDate, now),
      ),
    );

  const [attendedRow] = await db
    .select({ c: count() })
    .from(inspections)
    .where(
      and(eq(inspections.userId, userId), eq(inspections.attended, true)),
    );

  const recent = await db
    .select()
    .from(properties)
    .where(eq(properties.userId, userId))
    .orderBy(desc(properties.updatedAt))
    .limit(5);

  return {
    stats: {
      totalProperties: Number(totalRow?.c ?? 0),
      upcomingInspections: Number(upcomingRow?.c ?? 0),
      shortlisted: Number(shortlistedRow?.c ?? 0),
      inspectionsAttended: Number(attendedRow?.c ?? 0),
    },
    recent,
  };
}

export async function getDashboardDataSafe(
  clerkUserId: string | undefined,
): Promise<{
  stats: DashboardStats;
  recent: (typeof properties.$inferSelect)[];
}> {
  try {
    return await getDashboardData(clerkUserId);
  } catch {
    return { stats: emptyDashboardStats, recent: [] };
  }
}

export async function getPropertiesForClerkUser(
  clerkUserId: string | undefined,
): Promise<(typeof properties.$inferSelect)[]> {
  if (!clerkUserId || !process.env.DATABASE_URL) return [];
  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!userRow) return [];
  return db
    .select()
    .from(properties)
    .where(eq(properties.userId, userRow.id))
    .orderBy(desc(properties.updatedAt));
}

export async function getPropertiesForClerkUserSafe(
  clerkUserId: string | undefined,
): Promise<(typeof properties.$inferSelect)[]> {
  try {
    return await getPropertiesForClerkUser(clerkUserId);
  } catch {
    return [];
  }
}

export async function getPropertyForClerkUser(
  propertyId: string,
  clerkUserId: string | undefined,
): Promise<(typeof properties.$inferSelect) | null> {
  if (!clerkUserId || !process.env.DATABASE_URL || !isValidPropertyId(propertyId)) {
    return null;
  }
  const db = getDb();
  const rows = await db
    .select({ p: properties })
    .from(properties)
    .innerJoin(users, eq(properties.userId, users.id))
    .where(
      and(eq(properties.id, propertyId), eq(users.clerkId, clerkUserId)),
    )
    .limit(1);
  return rows[0]?.p ?? null;
}

export async function getPropertyForClerkUserSafe(
  propertyId: string,
  clerkUserId: string | undefined,
): Promise<(typeof properties.$inferSelect) | null> {
  try {
    return await getPropertyForClerkUser(propertyId, clerkUserId);
  } catch {
    return null;
  }
}
