import { startOfDay } from "date-fns";
import { and, eq, gte, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { agentInsights } from "@/lib/db/schema";

/** Removes cached daily briefing rows from today so generateDailyBriefing can regenerate. */
export async function deleteTodaysBriefingsForDbUser(
  dbUserId: string,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  const dayStart = startOfDay(new Date());
  await db.delete(agentInsights).where(
    and(
      eq(agentInsights.userId, dbUserId),
      eq(agentInsights.type, "briefing"),
      isNull(agentInsights.propertyId),
      gte(agentInsights.createdAt, dayStart),
    ),
  );
}
