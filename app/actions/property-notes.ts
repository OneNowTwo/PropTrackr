"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { properties, propertyNotes } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserRow() {
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

export async function createNote(formData: FormData): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!propertyId || !content) {
    return { ok: false, error: "Note cannot be empty." };
  }

  const db = getDb();
  const [prop] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
    )
    .limit(1);
  if (!prop) {
    return { ok: false, error: "Property not found." };
  }

  try {
    await db.insert(propertyNotes).values({
      propertyId,
      userId: dbUser.id,
      content,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save note.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const rows = await db
    .select({ id: propertyNotes.id, propertyId: propertyNotes.propertyId })
    .from(propertyNotes)
    .innerJoin(properties, eq(propertyNotes.propertyId, properties.id))
    .where(
      and(eq(propertyNotes.id, noteId), eq(properties.userId, dbUser.id)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Note not found." };
  }

  try {
    await db.delete(propertyNotes).where(eq(propertyNotes.id, noteId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${row.propertyId}`);
  return { ok: true };
}
