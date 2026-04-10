"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { inspectionPhotos, users } from "@/lib/db/schema";
import { deleteCloudinaryPhoto, uploadInspectionPhoto } from "@/lib/cloudinary";
import { auth } from "@clerk/nextjs/server";

export type InspectionPhoto = {
  id: string;
  propertyId: string;
  url: string;
  caption: string | null;
  takenAt: Date;
  createdAt: Date;
};

async function resolveUserId(): Promise<string | null> {
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

export async function uploadPhoto(
  propertyId: string,
  base64Image: string,
  caption?: string,
): Promise<{ ok: boolean; photo?: InspectionPhoto; error?: string }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false, error: "Not authenticated" };

    const url = await uploadInspectionPhoto(base64Image, propertyId);

    const db = getDb();
    const [inserted] = await db
      .insert(inspectionPhotos)
      .values({
        propertyId,
        userId,
        url,
        caption: caption || null,
      })
      .returning();

    revalidatePath(`/properties/${propertyId}`);

    return {
      ok: true,
      photo: {
        id: inserted.id,
        propertyId: inserted.propertyId,
        url: inserted.url,
        caption: inserted.caption,
        takenAt: inserted.takenAt,
        createdAt: inserted.createdAt,
      },
    };
  } catch (e) {
    console.error("[inspection-photos] upload error:", e);
    return { ok: false, error: "Upload failed" };
  }
}

export async function getPropertyPhotos(
  propertyId: string,
): Promise<InspectionPhoto[]> {
  try {
    const userId = await resolveUserId();
    if (!userId) return [];

    const db = getDb();
    const rows = await db
      .select()
      .from(inspectionPhotos)
      .where(
        and(
          eq(inspectionPhotos.propertyId, propertyId),
          eq(inspectionPhotos.userId, userId),
        ),
      )
      .orderBy(desc(inspectionPhotos.takenAt));

    return rows.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      url: r.url,
      caption: r.caption,
      takenAt: r.takenAt,
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

export async function deletePhoto(
  photoId: string,
): Promise<{ ok: boolean }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false };

    const db = getDb();
    const [row] = await db
      .select({ id: inspectionPhotos.id, url: inspectionPhotos.url, propertyId: inspectionPhotos.propertyId })
      .from(inspectionPhotos)
      .where(
        and(eq(inspectionPhotos.id, photoId), eq(inspectionPhotos.userId, userId)),
      )
      .limit(1);

    if (!row) return { ok: false };

    await deleteCloudinaryPhoto(row.url);
    await db.delete(inspectionPhotos).where(eq(inspectionPhotos.id, photoId));

    revalidatePath(`/properties/${row.propertyId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updatePhotoCaption(
  photoId: string,
  caption: string,
): Promise<{ ok: boolean }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false };

    const db = getDb();
    const [row] = await db
      .select({ id: inspectionPhotos.id, propertyId: inspectionPhotos.propertyId })
      .from(inspectionPhotos)
      .where(
        and(eq(inspectionPhotos.id, photoId), eq(inspectionPhotos.userId, userId)),
      )
      .limit(1);

    if (!row) return { ok: false };

    await db
      .update(inspectionPhotos)
      .set({ caption: caption || null })
      .where(eq(inspectionPhotos.id, photoId));

    revalidatePath(`/properties/${row.propertyId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
