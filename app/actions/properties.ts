"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { AU_STATES, PROPERTY_STATUSES } from "@/lib/property-form-constants";
import { normalizePropertyTypeForDb } from "@/lib/listing/normalize";

export type CreatePropertyState = {
  error?: string;
};

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeStateForDb(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (AU_STATES.includes(s as (typeof AU_STATES)[number])) return s;
  return "";
}

export async function createProperty(
  _prevState: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in to add a property." };
  }

  if (!process.env.DATABASE_URL) {
    return { error: "Database is not configured." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return {
      error: "Your account needs an email address before you can save listings.",
    };
  }

  const address = String(formData.get("address") ?? "").trim();
  const suburb = String(formData.get("suburb") ?? "").trim();
  const stateRaw = String(formData.get("state") ?? "").trim();
  const postcode = String(formData.get("postcode") ?? "").trim();
  const propertyTypeRaw = String(formData.get("propertyType") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "saved").trim();
  const listingUrlRaw = String(formData.get("listingUrl") ?? "").trim();
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const agentNameRaw = String(formData.get("agentName") ?? "").trim();
  const agencyNameRaw = String(formData.get("agencyName") ?? "").trim();
  const agentPhotoUrlRaw = String(formData.get("agentPhotoUrl") ?? "").trim();
  const agentEmailRaw = String(formData.get("agentEmail") ?? "").trim();
  const agentPhoneRaw = String(formData.get("agentPhone") ?? "").trim();

  if (!address) return { error: "Address is required." };
  if (!suburb) return { error: "Suburb is required." };

  const state = normalizeStateForDb(stateRaw);
  if (stateRaw && !state) {
    return { error: "Please choose a valid state or leave it blank." };
  }

  if (
    !PROPERTY_STATUSES.includes(statusRaw as (typeof PROPERTY_STATUSES)[number])
  ) {
    return { error: "Please choose a valid status." };
  }
  const status = statusRaw as (typeof PROPERTY_STATUSES)[number];

  const propertyType = propertyTypeRaw.trim()
    ? normalizePropertyTypeForDb(propertyTypeRaw) ?? "Other"
    : null;

  const price = parseOptionalInt(formData.get("price"));
  const bedrooms = parseOptionalInt(formData.get("bedrooms"));
  const bathrooms = parseOptionalInt(formData.get("bathrooms"));
  const parking = parseOptionalInt(formData.get("parking"));

  let listingUrl: string | null = listingUrlRaw || null;
  if (listingUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(listingUrl);
    } catch {
      return { error: "Listing URL must be a valid URL." };
    }
  }

  let imageUrl: string | null = imageUrlRaw || null;
  if (imageUrl) {
    try {
      const u = new URL(imageUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { error: "Image URL must be http(s)." };
      }
    } catch {
      return { error: "Image URL must be a valid URL." };
    }
  }

  let agentPhotoUrl: string | null = agentPhotoUrlRaw || null;
  if (agentPhotoUrl) {
    try {
      const u = new URL(agentPhotoUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { error: "Agent photo URL must be http(s)." };
      }
    } catch {
      return { error: "Agent photo URL must be a valid URL." };
    }
  }

  const agentName = agentNameRaw || null;
  const agencyName = agencyNameRaw || null;
  const agentEmail = agentEmailRaw || null;
  const agentPhone = agentPhoneRaw || null;

  let insertedId: string;
  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });

    const title = `${address}, ${suburb}`;

    const db = getDb();
    const [inserted] = await db
      .insert(properties)
      .values({
        userId: dbUser.id,
        title,
        address,
        suburb,
        state: state || "",
        postcode: postcode || "",
        price,
        bedrooms,
        bathrooms,
        parking,
        propertyType,
        status,
        listingUrl,
        imageUrl,
        notes: notesRaw || null,
        agentName,
        agencyName,
        agentPhotoUrl,
        agentEmail,
        agentPhone,
      })
      .returning({ id: properties.id });

    if (!inserted) {
      return { error: "Could not save the property. Try again." };
    }
    insertedId = inserted.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { error: message || "Something went wrong. Try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath(`/properties/${insertedId}`);

  redirect(`/properties/${insertedId}`);
}
