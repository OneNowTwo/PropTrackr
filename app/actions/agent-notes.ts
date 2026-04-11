"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  type AgentNotePublic,
  type AgentRatingSummary,
  getAgentPerformanceNotesForClerkSafe,
} from "@/lib/db/agent-queries";
import { agentNotes, agents, users } from "@/lib/db/schema";

const CATEGORIES = new Set([
  "general",
  "communication",
  "honesty",
  "negotiation",
  "knowledge",
]);

async function resolveDbUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row?.id ?? null;
}

async function assertCanAccessAgent(
  agentId: string,
  dbUserId: string,
): Promise<boolean> {
  const db = getDb();
  const hhIds = await getHouseholdUserIds(dbUserId);
  const [a] = await db
    .select({ userId: agents.userId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  return !!a && hhIds.includes(a.userId);
}

export async function addAgentNote(
  agentId: string,
  note: string,
  rating?: number | null,
  category?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = note.trim();
  if (!body) {
    return { ok: false, error: "Please enter a note." };
  }
  if (body.length > 8000) {
    return { ok: false, error: "Note is too long." };
  }

  let r: number | null = null;
  if (rating != null) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: "Rating must be between 1 and 5." };
    }
    r = rating;
  }

  const catRaw = (category?.trim().toLowerCase() || "general") as string;
  const cat = CATEGORIES.has(catRaw) ? catRaw : "general";

  const dbUserId = await resolveDbUserId();
  if (!dbUserId) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!(await assertCanAccessAgent(agentId, dbUserId))) {
    return { ok: false, error: "Agent not found." };
  }

  try {
    const db = getDb();
    await db.insert(agentNotes).values({
      agentId,
      userId: dbUserId,
      note: body,
      rating: r,
      category: cat,
    });
    revalidatePath("/agents");
    revalidatePath(`/agents/${agentId}`);
    return { ok: true };
  } catch (e) {
    console.error("[agent-notes] addAgentNote:", e);
    return { ok: false, error: "Could not save note." };
  }
}

export async function getAgentNotes(
  agentId: string,
): Promise<AgentNotePublic[]> {
  const { userId: clerkId } = await auth();
  const bundle = await getAgentPerformanceNotesForClerkSafe(
    agentId,
    clerkId ?? undefined,
  );
  return bundle?.notes ?? [];
}

export async function getAgentRatingSummary(
  agentId: string,
): Promise<AgentRatingSummary | null> {
  const { userId: clerkId } = await auth();
  const bundle = await getAgentPerformanceNotesForClerkSafe(
    agentId,
    clerkId ?? undefined,
  );
  return bundle?.summary ?? null;
}

export async function deleteAgentNote(
  noteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ agentId: agentNotes.agentId })
      .from(agentNotes)
      .where(and(eq(agentNotes.id, noteId), eq(agentNotes.userId, dbUserId)))
      .limit(1);
    if (!row) {
      return { ok: false, error: "Note not found." };
    }

    await db.delete(agentNotes).where(eq(agentNotes.id, noteId));
    revalidatePath("/agents");
    revalidatePath(`/agents/${row.agentId}`);
    return { ok: true };
  } catch (e) {
    console.error("[agent-notes] deleteAgentNote:", e);
    return { ok: false, error: "Could not delete note." };
  }
}
