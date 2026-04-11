import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { ensureSuburbFollowed } from "@/app/actions/suburbs";
import {
  DEFAULT_BRIEFING_TIMEZONE,
  getBriefingDayKeyInTimeZone,
} from "@/lib/agent/briefing";
import { getDb } from "@/lib/db";
import { agentInsights } from "@/lib/db/schema";

export function suburbDetailPath(suburb: string, postcode: string): string {
  const slug = `${suburb.trim().toLowerCase().replace(/\s+/g, "-")}-${postcode.trim()}`;
  return `/suburbs/${slug}`;
}

/** After a property is saved: follow suburb, clear today’s briefing cache, revalidate key routes. */
export async function invalidateUserCacheAfterPropertySave(
  dbUserId: string,
  suburb: string,
  postcode: string,
  propertyId: string,
  state: string = "NSW",
): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  await ensureSuburbFollowed(dbUserId, suburb, state, postcode);

  const db = getDb();
  const dayKey = getBriefingDayKeyInTimeZone(
    new Date(),
    DEFAULT_BRIEFING_TIMEZONE,
  );
  const titleKey = `brief:${dayKey}`;

  await db.delete(agentInsights).where(
    and(
      eq(agentInsights.userId, dbUserId),
      eq(agentInsights.type, "briefing"),
      isNull(agentInsights.propertyId),
      eq(agentInsights.title, titleKey),
    ),
  );

  revalidatePath("/dashboard");
  revalidatePath("/suburbs");
  revalidatePath("/agent");
  revalidatePath("/agents");
  revalidatePath("/market");
  revalidatePath("/properties");
  revalidatePath("/planner");
  revalidatePath(suburbDetailPath(suburb, postcode));
  revalidatePath(`/properties/${propertyId}`);

  console.log("[cache] invalidated after property save:", suburb, postcode);
}
