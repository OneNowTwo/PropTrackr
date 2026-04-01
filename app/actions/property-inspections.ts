"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { inspections, properties, users } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { INSPECTION_DURATION_OPTIONS } from "@/lib/property-detail-constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserRow() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  const dbUser = await getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
  return dbUser;
}

export async function createInspection(formData: FormData): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const dateStr = String(formData.get("inspectionDate") ?? "").trim();
  const timeStr = String(formData.get("inspectionTime") ?? "").trim();
  const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!propertyId || !dateStr || !timeStr) {
    return { ok: false, error: "Date and time are required." };
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) {
    return { ok: false, error: "Invalid date." };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const inspectionDate = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

  const durationMinutes = Number.parseInt(durationRaw, 10);
  if (
    !INSPECTION_DURATION_OPTIONS.includes(
      durationMinutes as (typeof INSPECTION_DURATION_OPTIONS)[number],
    )
  ) {
    return { ok: false, error: "Choose a valid duration." };
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
    await db.insert(inspections).values({
      propertyId,
      userId: dbUser.id,
      inspectionDate,
      inspectionTime: timeStr,
      durationMinutes,
      attended: false,
      notes: notesRaw || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save inspection.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function toggleInspectionAttended(
  inspectionId: string,
): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: inspections.id,
      attended: inspections.attended,
      propertyId: inspections.propertyId,
    })
    .from(inspections)
    .innerJoin(properties, eq(inspections.propertyId, properties.id))
    .where(
      and(
        eq(inspections.id, inspectionId),
        eq(properties.userId, dbUser.id),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Inspection not found." };
  }

  try {
    await db
      .update(inspections)
      .set({ attended: !row.attended })
      .where(eq(inspections.id, inspectionId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${row.propertyId}`);
  return { ok: true };
}

export async function deleteInspection(inspectionId: string): Promise<ActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const rows = await db
    .select({ propertyId: inspections.propertyId })
    .from(inspections)
    .innerJoin(properties, eq(inspections.propertyId, properties.id))
    .where(
      and(
        eq(inspections.id, inspectionId),
        eq(properties.userId, dbUser.id),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Inspection not found." };
  }

  try {
    await db.delete(inspections).where(eq(inspections.id, inspectionId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${row.propertyId}`);
  return { ok: true };
}
