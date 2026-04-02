import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  agentChecklistItems,
  agents,
  inspections,
  properties,
  users,
} from "@/lib/db/schema";

import { isValidPropertyId } from "./queries";

export type AgentWithCount = typeof agents.$inferSelect & {
  propertyCount: number;
};

export async function getAgentsWithPropertyCountsForClerkSafe(
  clerkUserId: string | undefined,
): Promise<AgentWithCount[]> {
  if (!clerkUserId || !process.env.DATABASE_URL) return [];
  try {
    const db = getDb();
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!userRow) return [];

    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, userRow.id))
      .orderBy(desc(agents.updatedAt));

    const countRows = await db
      .select({
        agentId: properties.agentId,
        c: count(),
      })
      .from(properties)
      .where(
        and(
          eq(properties.userId, userRow.id),
          isNotNull(properties.agentId),
        ),
      )
      .groupBy(properties.agentId);

    const countMap = new Map<string, number>();
    for (const row of countRows) {
      if (row.agentId) countMap.set(row.agentId, Number(row.c ?? 0));
    }

    return agentRows.map((a) => ({
      ...a,
      propertyCount: countMap.get(a.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

export type AgentDetailBundle = {
  agent: typeof agents.$inferSelect;
  linkedProperties: (typeof properties.$inferSelect)[];
  checklist: (typeof agentChecklistItems.$inferSelect)[];
  propertyOptions: {
    id: string;
    title: string;
    address: string;
    suburb: string;
  }[];
  /** Inspections marked attended on properties linked to this agent. */
  inspectionsAttendedWithAgent: number;
};

export async function getAgentDetailForClerkSafe(
  agentId: string,
  clerkUserId: string | undefined,
): Promise<AgentDetailBundle | null> {
  if (!clerkUserId || !process.env.DATABASE_URL || !isValidPropertyId(agentId)) {
    return null;
  }
  try {
    const db = getDb();
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!userRow) return null;

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userRow.id)))
      .limit(1);
    if (!agent) return null;

    const [linkedProperties, checklist, propertyOptions] = await Promise.all([
      db
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.userId, userRow.id),
            eq(properties.agentId, agentId),
          ),
        )
        .orderBy(desc(properties.updatedAt)),
      db
        .select()
        .from(agentChecklistItems)
        .where(
          and(
            eq(agentChecklistItems.agentId, agentId),
            eq(agentChecklistItems.userId, userRow.id),
          ),
        )
        .orderBy(desc(agentChecklistItems.createdAt)),
      db
        .select({
          id: properties.id,
          title: properties.title,
          address: properties.address,
          suburb: properties.suburb,
        })
        .from(properties)
        .where(eq(properties.userId, userRow.id))
        .orderBy(desc(properties.updatedAt)),
    ]);

    const propertyIds = linkedProperties.map((p) => p.id);
    let inspectionsAttendedWithAgent = 0;
    if (propertyIds.length > 0) {
      const [inspRow] = await db
        .select({ c: count() })
        .from(inspections)
        .where(
          and(
            eq(inspections.userId, userRow.id),
            inArray(inspections.propertyId, propertyIds),
            eq(inspections.attended, true),
          ),
        );
      inspectionsAttendedWithAgent = Number(inspRow?.c ?? 0);
    }

    return {
      agent,
      linkedProperties,
      checklist,
      propertyOptions,
      inspectionsAttendedWithAgent,
    };
  } catch {
    return null;
  }
}
