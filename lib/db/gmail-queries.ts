import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  agents,
  documents,
  gmailConnections,
  properties,
  propertyEmails,
  users,
} from "@/lib/db/schema";

import { isValidPropertyId } from "./queries";

export async function getGmailConnectionForUserId(
  userId: string,
): Promise<typeof gmailConnections.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getGmailConnectionForClerkSafe(
  clerkUserId: string | undefined,
): Promise<typeof gmailConnections.$inferSelect | null> {
  if (!clerkUserId || !process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return null;
    return getGmailConnectionForUserId(u.id);
  } catch {
    return null;
  }
}

export async function getPropertyEmailsForPropertySafe(
  propertyId: string,
  clerkUserId: string | undefined,
): Promise<(typeof propertyEmails.$inferSelect)[]> {
  if (!clerkUserId || !process.env.DATABASE_URL || !isValidPropertyId(propertyId)) {
    return [];
  }
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return [];
    return db
      .select()
      .from(propertyEmails)
      .where(
        and(
          eq(propertyEmails.userId, u.id),
          eq(propertyEmails.propertyId, propertyId),
        ),
      )
      .orderBy(desc(propertyEmails.receivedAt));
  } catch {
    return [];
  }
}

export async function getUnmatchedPropertyEmailsForUserSafe(
  clerkUserId: string | undefined,
): Promise<(typeof propertyEmails.$inferSelect)[]> {
  if (!clerkUserId || !process.env.DATABASE_URL) return [];
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return [];
    return db
      .select()
      .from(propertyEmails)
      .where(
        and(eq(propertyEmails.userId, u.id), isNull(propertyEmails.propertyId)),
      )
      .orderBy(desc(propertyEmails.receivedAt))
      .limit(50);
  } catch {
    return [];
  }
}

export type DashboardEmailRow = typeof propertyEmails.$inferSelect & {
  propertyAddress: string | null;
  propertySuburb: string | null;
};

export async function getRecentPropertyEmailsForDashboardSafe(
  clerkUserId: string | undefined,
  limit: number,
): Promise<DashboardEmailRow[]> {
  if (!clerkUserId || !process.env.DATABASE_URL) return [];
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return [];
    const rows = await db
      .select({
        email: propertyEmails,
        propertyAddress: properties.address,
        propertySuburb: properties.suburb,
      })
      .from(propertyEmails)
      .leftJoin(properties, eq(propertyEmails.propertyId, properties.id))
      .where(
        and(
          eq(propertyEmails.userId, u.id),
          isNotNull(propertyEmails.propertyId),
        ),
      )
      .orderBy(desc(propertyEmails.receivedAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r.email,
      propertyAddress: r.propertyAddress,
      propertySuburb: r.propertySuburb,
    }));
  } catch {
    return [];
  }
}

export async function getPropertyEmailsForAgentSafe(
  agentId: string,
  clerkUserId: string | undefined,
): Promise<(typeof propertyEmails.$inferSelect)[]> {
  if (!clerkUserId || !process.env.DATABASE_URL || !isValidPropertyId(agentId)) {
    return [];
  }
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return [];
    const [agentRow] = await db
      .select({ email: agents.email })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, u.id)))
      .limit(1);
    const em = agentRow?.email?.trim().toLowerCase();
    return db
      .select()
      .from(propertyEmails)
      .where(
        and(
          eq(propertyEmails.userId, u.id),
          em
            ? or(
                eq(propertyEmails.agentId, agentId),
                sql`lower(${propertyEmails.fromEmail}) = ${em}`,
              )
            : eq(propertyEmails.agentId, agentId),
        ),
      )
      .orderBy(desc(propertyEmails.receivedAt));
  } catch {
    return [];
  }
}

export async function getGmailDocumentsForPropertyAndMessages(
  userId: string,
  propertyId: string,
  gmailMessageIds: string[],
): Promise<(typeof documents.$inferSelect)[]> {
  if (gmailMessageIds.length === 0) return [];
  const db = getDb();
  const { inArray } = await import("drizzle-orm");
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.propertyId, propertyId),
        inArray(documents.gmailMessageId, gmailMessageIds),
      ),
    );
}
