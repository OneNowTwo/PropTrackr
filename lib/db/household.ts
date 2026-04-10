import { eq } from "drizzle-orm";

import { getDb } from "./index";
import { householdMembers, users } from "./schema";

/**
 * Returns all user IDs in the same household as the given user,
 * including the user themselves. If the user has no household,
 * returns just [userId].
 */
export async function getHouseholdUserIds(userId: string): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [userId];

  try {
    const db = getDb();

    const [membership] = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!membership) return [userId];

    const members = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, membership.householdId));

    const ids = members.map((m) => m.userId);
    return ids.length > 0 ? ids : [userId];
  } catch {
    return [userId];
  }
}

/**
 * Same as getHouseholdUserIds but takes a clerkId and resolves to the DB user first.
 */
export async function getHouseholdUserIdsByClerk(
  clerkId: string | undefined,
): Promise<string[]> {
  if (!clerkId || !process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!userRow) return [];
    return getHouseholdUserIds(userRow.id);
  } catch {
    return [];
  }
}
