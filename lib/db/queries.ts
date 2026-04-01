import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";

import { getDb } from "./index";
import {
  discoveredProperties,
  documents,
  inspections,
  properties,
  propertyNotes,
  searchPreferences,
  suburbAgencyUrls,
  users,
  voiceNotes,
} from "./schema";

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

export type InspectionRow = typeof inspections.$inferSelect;
export type PropertyNoteRow = typeof propertyNotes.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type VoiceNoteRow = typeof voiceNotes.$inferSelect;

function inspectionTimestamp(row: InspectionRow): number {
  const day = new Date(row.inspectionDate).getTime();
  const [hRaw, mRaw] = row.inspectionTime.split(":");
  const h = Number.parseInt(hRaw ?? "0", 10) || 0;
  const m = Number.parseInt(mRaw ?? "0", 10) || 0;
  return day + (h * 60 + m) * 60 * 1000;
}

export async function getInspectionsForProperty(
  propertyId: string,
): Promise<InspectionRow[]> {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return [];
  const db = getDb();
  return db
    .select()
    .from(inspections)
    .where(eq(inspections.propertyId, propertyId))
    .orderBy(desc(inspections.inspectionDate));
}

export async function getInspectionsForPropertySafe(
  propertyId: string,
): Promise<{ upcoming: InspectionRow[]; past: InspectionRow[] }> {
  try {
    const rows = await getInspectionsForProperty(propertyId);
    const now = Date.now();
    const upcoming = rows
      .filter((r) => inspectionTimestamp(r) >= now)
      .sort((a, b) => inspectionTimestamp(a) - inspectionTimestamp(b));
    const past = rows
      .filter((r) => inspectionTimestamp(r) < now)
      .sort((a, b) => inspectionTimestamp(b) - inspectionTimestamp(a));
    return { upcoming, past };
  } catch {
    return { upcoming: [], past: [] };
  }
}

export type PlannerInspectionRow = {
  id: string;
  propertyId: string;
  userId: string;
  inspectionDate: Date;
  inspectionTime: string;
  durationMinutes: number | null;
  attended: boolean;
  notes: string | null;
  createdAt: Date;
  propertyAddress: string;
  propertySuburb: string;
  propertyStatus: (typeof properties.$inferSelect)["status"];
};

export async function getInspectionsForUser(
  clerkUserId: string | undefined,
): Promise<PlannerInspectionRow[]> {
  if (!clerkUserId || !process.env.DATABASE_URL) return [];
  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!userRow) return [];

  const rows = await db
    .select({
      id: inspections.id,
      propertyId: inspections.propertyId,
      userId: inspections.userId,
      inspectionDate: inspections.inspectionDate,
      inspectionTime: inspections.inspectionTime,
      durationMinutes: inspections.durationMinutes,
      attended: inspections.attended,
      notes: inspections.notes,
      createdAt: inspections.createdAt,
      propertyAddress: properties.address,
      propertySuburb: properties.suburb,
      propertyStatus: properties.status,
    })
    .from(inspections)
    .innerJoin(properties, eq(inspections.propertyId, properties.id))
    .where(
      and(eq(properties.userId, userRow.id), eq(inspections.userId, userRow.id)),
    )
    .orderBy(asc(inspections.inspectionDate), asc(inspections.inspectionTime));

  return rows;
}

export async function getInspectionsForUserSafe(
  clerkUserId: string | undefined,
): Promise<PlannerInspectionRow[]> {
  try {
    return await getInspectionsForUser(clerkUserId);
  } catch {
    return [];
  }
}

export async function getPropertyNotesForProperty(
  propertyId: string,
): Promise<PropertyNoteRow[]> {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return [];
  const db = getDb();
  return db
    .select()
    .from(propertyNotes)
    .where(eq(propertyNotes.propertyId, propertyId))
    .orderBy(desc(propertyNotes.createdAt));
}

export async function getPropertyNotesForPropertySafe(
  propertyId: string,
): Promise<PropertyNoteRow[]> {
  try {
    return await getPropertyNotesForProperty(propertyId);
  } catch {
    return [];
  }
}

export async function getDocumentsForProperty(
  propertyId: string,
): Promise<DocumentRow[]> {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return [];
  const db = getDb();
  return db
    .select()
    .from(documents)
    .where(eq(documents.propertyId, propertyId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentsForPropertySafe(
  propertyId: string,
): Promise<DocumentRow[]> {
  try {
    return await getDocumentsForProperty(propertyId);
  } catch {
    return [];
  }
}

export async function getVoiceNotesForProperty(
  propertyId: string,
): Promise<VoiceNoteRow[]> {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return [];
  const db = getDb();
  return db
    .select()
    .from(voiceNotes)
    .where(eq(voiceNotes.propertyId, propertyId))
    .orderBy(desc(voiceNotes.createdAt));
}

export async function getVoiceNotesForPropertySafe(
  propertyId: string,
): Promise<VoiceNoteRow[]> {
  try {
    return await getVoiceNotesForProperty(propertyId);
  } catch {
    return [];
  }
}

export type DiscoveredPropertyRow = typeof discoveredProperties.$inferSelect;

export async function getSearchPreferencesForUser(
  clerkUserId: string | undefined,
): Promise<typeof searchPreferences.$inferSelect | null> {
  if (!clerkUserId || !process.env.DATABASE_URL) return null;
  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!userRow) return null;
  const [row] = await db
    .select()
    .from(searchPreferences)
    .where(eq(searchPreferences.userId, userRow.id))
    .limit(1);
  if (!row) return null;
  const suburbs = Array.isArray(row.suburbs) ? row.suburbs : [];
  const propertyTypes = Array.isArray(row.propertyTypes)
    ? row.propertyTypes
    : [];
  return { ...row, suburbs, propertyTypes };
}

export async function getSearchPreferencesForUserSafe(
  clerkUserId: string | undefined,
): Promise<typeof searchPreferences.$inferSelect | null> {
  try {
    return await getSearchPreferencesForUser(clerkUserId);
  } catch {
    return null;
  }
}

export type SuburbAgencyUrlRow = typeof suburbAgencyUrls.$inferSelect;

export async function getSuburbAgencyUrlsForClerkUser(
  clerkUserId: string | undefined,
): Promise<SuburbAgencyUrlRow[]> {
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
    .from(suburbAgencyUrls)
    .where(eq(suburbAgencyUrls.userId, userRow.id))
    .orderBy(asc(suburbAgencyUrls.suburb), asc(suburbAgencyUrls.agencyName));
}

export async function getSuburbAgencyUrlsForClerkUserSafe(
  clerkUserId: string | undefined,
): Promise<SuburbAgencyUrlRow[]> {
  try {
    return await getSuburbAgencyUrlsForClerkUser(clerkUserId);
  } catch {
    return [];
  }
}

export async function getDiscoveredPropertiesForUser(
  clerkUserId: string | undefined,
  statuses: ("pending" | "maybe")[],
): Promise<DiscoveredPropertyRow[]> {
  if (!clerkUserId || !process.env.DATABASE_URL || statuses.length === 0) {
    return [];
  }
  const db = getDb();
  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!userRow) return [];
  const rows = await db
    .select()
    .from(discoveredProperties)
    .where(
      and(
        eq(discoveredProperties.userId, userRow.id),
        inArray(discoveredProperties.status, statuses),
      ),
    )
    .orderBy(desc(discoveredProperties.scrapedAt));

  console.log("[getDiscoveredPropertiesForUser]", {
    internalUserId: userRow.id,
    statuses,
    rowCount: rows.length,
  });

  return rows;
}

export async function getDiscoveredPropertiesForUserSafe(
  clerkUserId: string | undefined,
  statuses: ("pending" | "maybe")[],
): Promise<DiscoveredPropertyRow[]> {
  try {
    return await getDiscoveredPropertiesForUser(clerkUserId, statuses);
  } catch (e) {
    console.error(
      "[getDiscoveredPropertiesForUserSafe] query failed:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}
