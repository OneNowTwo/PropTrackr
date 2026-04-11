import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  agentChecklistItems,
  agentNotes,
  agents,
  inspections,
  properties,
  users,
} from "@/lib/db/schema";

import { isValidPropertyId } from "./queries";

export type AgentWithCount = typeof agents.$inferSelect & {
  propertyCount: number;
  noteCount: number;
  avgRating: number | null;
};

export type AgentNotePublic = {
  id: string;
  note: string;
  rating: number | null;
  category: string | null;
  createdAt: Date;
  userId: string;
};

export type AgentRatingSummary = {
  averageRating: number | null;
  ratedCount: number;
  noteCount: number;
  byCategory: Array<{
    category: string;
    averageRating: number | null;
    count: number;
  }>;
};

function computeRatingSummary(
  notes: { rating: number | null; category: string | null }[],
): AgentRatingSummary {
  const rated = notes.filter(
    (n) => n.rating != null && n.rating >= 1 && n.rating <= 5,
  );
  const avg =
    rated.length === 0
      ? null
      : Math.round(
          (rated.reduce((s, n) => s + (n.rating as number), 0) /
            rated.length) *
            10,
        ) / 10;

  const catMap = new Map<
    string,
    { ratings: number[]; count: number }
  >();
  for (const n of notes) {
    const c = (n.category?.trim() || "general").toLowerCase();
    if (!catMap.has(c)) catMap.set(c, { ratings: [], count: 0 });
    const entry = catMap.get(c)!;
    entry.count += 1;
    if (n.rating != null && n.rating >= 1 && n.rating <= 5) {
      entry.ratings.push(n.rating);
    }
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({
      category,
      count: v.count,
      averageRating:
        v.ratings.length === 0
          ? null
          : Math.round(
              (v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) * 10,
            ) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    averageRating: avg,
    ratedCount: rated.length,
    noteCount: notes.length,
    byCategory,
  };
}

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

    const hhIds = await getHouseholdUserIds(userRow.id);

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

    const noteAggRows = await db
      .select({
        agentId: agentNotes.agentId,
        noteCount: count(),
        avgRating: sql<number | null>`avg(${agentNotes.rating})::float`,
      })
      .from(agentNotes)
      .innerJoin(agents, eq(agentNotes.agentId, agents.id))
      .where(
        and(inArray(agents.userId, hhIds), inArray(agentNotes.userId, hhIds)),
      )
      .groupBy(agentNotes.agentId);

    const noteMap = new Map<
      string,
      { noteCount: number; avgRating: number | null }
    >();
    for (const row of noteAggRows) {
      noteMap.set(row.agentId, {
        noteCount: Number(row.noteCount ?? 0),
        avgRating:
          row.avgRating == null
            ? null
            : Math.round(Number(row.avgRating) * 10) / 10,
      });
    }

    return agentRows.map((a) => {
      const ns = noteMap.get(a.id);
      return {
        ...a,
        propertyCount: countMap.get(a.id) ?? 0,
        noteCount: ns?.noteCount ?? 0,
        avgRating: ns?.avgRating ?? null,
      };
    });
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

export async function getAgentPerformanceNotesForClerkSafe(
  agentId: string,
  clerkUserId: string | undefined,
): Promise<{
  notes: AgentNotePublic[];
  summary: AgentRatingSummary;
} | null> {
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

    const hhIds = await getHouseholdUserIds(userRow.id);

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userRow.id)))
      .limit(1);
    if (!agent) return null;

    const rows = await db
      .select({
        id: agentNotes.id,
        note: agentNotes.note,
        rating: agentNotes.rating,
        category: agentNotes.category,
        createdAt: agentNotes.createdAt,
        userId: agentNotes.userId,
      })
      .from(agentNotes)
      .where(
        and(
          eq(agentNotes.agentId, agentId),
          inArray(agentNotes.userId, hhIds),
        ),
      )
      .orderBy(desc(agentNotes.createdAt));

    const notes: AgentNotePublic[] = rows.map((r) => ({
      id: r.id,
      note: r.note,
      rating: r.rating,
      category: r.category,
      createdAt: r.createdAt,
      userId: r.userId,
    }));

    return {
      notes,
      summary: computeRatingSummary(notes),
    };
  } catch {
    return null;
  }
}
