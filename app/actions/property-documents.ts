"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { documents, properties } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import {
  DOCUMENT_TYPE_OPTIONS,
  type DocumentTypeOption,
} from "@/lib/property-detail-constants";

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

export async function createDocument(formData: FormData): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const fileName = String(formData.get("fileName") ?? "").trim();
  const fileUrlRaw = String(formData.get("fileUrl") ?? "").trim();
  const fileType = String(formData.get("fileType") ?? "").trim();

  if (!propertyId || !fileName || !fileUrlRaw) {
    return { ok: false, error: "Name and URL are required." };
  }

  if (!DOCUMENT_TYPE_OPTIONS.includes(fileType as DocumentTypeOption)) {
    return { ok: false, error: "Invalid document type." };
  }

  try {
    const u = new URL(fileUrlRaw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "URL must be http(s)." };
    }
  } catch {
    return { ok: false, error: "Invalid URL." };
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
    await db.insert(documents).values({
      propertyId,
      userId: dbUser.id,
      fileUrl: fileUrlRaw,
      fileName,
      fileType,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save document.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const rows = await db
    .select({ id: documents.id, propertyId: documents.propertyId })
    .from(documents)
    .innerJoin(properties, eq(documents.propertyId, properties.id))
    .where(
      and(eq(documents.id, documentId), eq(properties.userId, dbUser.id)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Document not found." };
  }

  try {
    await db.delete(documents).where(eq(documents.id, documentId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${row.propertyId}`);
  return { ok: true };
}
