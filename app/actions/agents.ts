"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  agentChecklistItems,
  agents,
  properties,
} from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { isValidPropertyId } from "@/lib/db/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireDbUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  return getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
}

function validateHttpUrl(raw: string | null): string | null {
  const t = raw?.trim() || "";
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return t;
  } catch {
    return null;
  }
}

export async function createAgent(formData: FormData): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  const agencyName = String(formData.get("agencyName") ?? "").trim() || null;
  const photoRaw = String(formData.get("photoUrl") ?? "").trim();
  const photoUrl = validateHttpUrl(photoRaw);
  if (photoRaw && !photoUrl) {
    return { ok: false, error: "Photo URL must be a valid http(s) URL." };
  }
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    const db = getDb();
    await db.insert(agents).values({
      userId: dbUser.id,
      name,
      agencyName,
      photoUrl,
      email,
      phone,
      notes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create agent.";
    return { ok: false, error: msg };
  }

  revalidatePath("/agents");
  return { ok: true };
}

export async function updateAgent(formData: FormData): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };

  const agentId = String(formData.get("agentId") ?? "").trim();
  if (!agentId || !isValidPropertyId(agentId)) {
    return { ok: false, error: "Invalid agent." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  const agencyName = String(formData.get("agencyName") ?? "").trim() || null;
  const photoRaw = String(formData.get("photoUrl") ?? "").trim();
  const photoUrl = validateHttpUrl(photoRaw);
  if (photoRaw && !photoUrl) {
    return { ok: false, error: "Photo URL must be a valid http(s) URL." };
  }
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    const db = getDb();
    const updated = await db
      .update(agents)
      .set({
        name,
        agencyName,
        photoUrl,
        email,
        phone,
        notes,
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.userId, dbUser.id)))
      .returning({ id: agents.id });

    if (!updated.length) {
      return { ok: false, error: "Agent not found." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update agent.";
    return { ok: false, error: msg };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/properties");
  return { ok: true };
}

export async function deleteAgent(agentId: string): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(agentId)) {
    return { ok: false, error: "Invalid agent." };
  }

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .update(properties)
        .set({ agentId: null, updatedAt: new Date() })
        .where(
          and(eq(properties.agentId, agentId), eq(properties.userId, dbUser.id)),
        );
      await tx
        .delete(agentChecklistItems)
        .where(
          and(
            eq(agentChecklistItems.agentId, agentId),
            eq(agentChecklistItems.userId, dbUser.id),
          ),
        );
      const del = await tx
        .delete(agents)
        .where(and(eq(agents.id, agentId), eq(agents.userId, dbUser.id)))
        .returning({ id: agents.id });

      if (!del.length) {
        throw new Error("Agent not found.");
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete agent.";
    return { ok: false, error: msg };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/properties");
  revalidatePath("/planner");
  revalidatePath("/compare");
  return { ok: true };
}

export async function createChecklistItem(
  formData: FormData,
): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };

  const agentId = String(formData.get("agentId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const propertyIdRaw = String(formData.get("propertyId") ?? "").trim();

  if (!agentId || !isValidPropertyId(agentId)) {
    return { ok: false, error: "Invalid agent." };
  }
  if (!content) return { ok: false, error: "Content is required." };

  let propertyId: string | null = null;
  if (propertyIdRaw) {
    if (!isValidPropertyId(propertyIdRaw)) {
      return { ok: false, error: "Invalid property." };
    }
    propertyId = propertyIdRaw;
  }

  try {
    const db = getDb();
    const [agentOk] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, dbUser.id)))
      .limit(1);
    if (!agentOk) return { ok: false, error: "Agent not found." };

    if (propertyId) {
      const [propOk] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
        )
        .limit(1);
      if (!propOk) return { ok: false, error: "Property not found." };
    }

    await db.insert(agentChecklistItems).values({
      agentId,
      userId: dbUser.id,
      propertyId,
      content,
      completed: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not add item.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(itemId)) {
    return { ok: false, error: "Invalid item." };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: agentChecklistItems.id,
        completed: agentChecklistItems.completed,
        agentId: agentChecklistItems.agentId,
      })
      .from(agentChecklistItems)
      .where(
        and(
          eq(agentChecklistItems.id, itemId),
          eq(agentChecklistItems.userId, dbUser.id),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Item not found." };

    await db
      .update(agentChecklistItems)
      .set({ completed: !row.completed })
      .where(eq(agentChecklistItems.id, itemId));
    revalidatePath(`/agents/${row.agentId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update item.";
    return { ok: false, error: msg };
  }

  return { ok: true };
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  const dbUser = await requireDbUser();
  if (!dbUser) return { ok: false, error: "You must be signed in." };
  if (!isValidPropertyId(itemId)) {
    return { ok: false, error: "Invalid item." };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ agentId: agentChecklistItems.agentId })
      .from(agentChecklistItems)
      .where(
        and(
          eq(agentChecklistItems.id, itemId),
          eq(agentChecklistItems.userId, dbUser.id),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, error: "Item not found." };

    await db
      .delete(agentChecklistItems)
      .where(eq(agentChecklistItems.id, itemId));

    revalidatePath(`/agents/${row.agentId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete item.";
    return { ok: false, error: msg };
  }

  return { ok: true };
}
