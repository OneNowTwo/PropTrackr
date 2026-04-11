"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { deleteTodaysBriefingsForDbUser } from "@/lib/db/delete-todays-briefings";
import { invalidateUserCacheAfterPropertySave } from "@/lib/db/invalidate-user-cache";
import { resolveOrCreateAgentId } from "@/lib/db/agent-sync";
import { isValidPropertyId } from "@/lib/db/queries";
import { properties, propertyEmails } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { AU_STATES, PROPERTY_STATUSES } from "@/lib/property-form-constants";
import { normalizePropertyTypeForDb } from "@/lib/listing/normalize";
import { coerceClaudeJsonString } from "@/lib/listing/coerce-claude-json-string";
import {
  buildAuctionNoteLine,
  insertInspectionSlotsForProperty,
  mergeNotesWithAuctionLine,
  normalizeAuctionDate,
  normalizeAuctionTime,
  normalizeInspectionDatesFromExtract,
} from "@/lib/listing/inspection-autofill";

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

function parseImageUrlsFromForm(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const item of v) {
      const urlStr = String(item ?? "").trim();
      if (!urlStr) continue;
      try {
        const u = new URL(urlStr);
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      } catch {
        continue;
      }
      out.push(urlStr);
      if (out.length >= 7) break;
    }
    return out;
  } catch {
    return [];
  }
}

function parseInspectionDatesHidden(raw: string) {
  const s = raw.trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    return normalizeInspectionDatesFromExtract(v);
  } catch {
    return [];
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip trailing ", Suburb [State] [Postcode]" when it matches structured fields (avoid duplicate suburb in address line). */
function normalizeStoredAddressLine(
  address: string,
  suburb: string,
  state: string,
  postcode: string,
): string {
  let a = address.trim();
  const sub = suburb.trim();
  if (!sub) return a;

  const s = state.trim();
  const pc = postcode.trim();
  const candidates: string[] = [];
  if (s && pc) {
    candidates.push(
      `, ${sub} ${s} ${pc}`,
      `, ${sub}, ${s} ${pc}`,
    );
  }
  if (s) {
    candidates.push(`, ${sub} ${s}`, `, ${sub}, ${s}`);
  }
  candidates.push(`, ${sub}`);

  for (const c of candidates) {
    const re = new RegExp(`${escapeRegex(c)}\\s*$`, "i");
    if (re.test(a)) {
      a = a.replace(re, "").trim().replace(/,\s*$/, "").trim();
      break;
    }
  }
  return a;
}

/** True if `text` already contains suburb as a delimited token (start/comma/whitespace before; end/comma/whitespace after). */
function addressAlreadyContainsSuburb(text: string, suburb: string): boolean {
  const raw = text.trim();
  const sub = suburb.trim();
  if (!raw || !sub) return false;
  const escaped = sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[,\\s])${escaped}(?:$|[,\\s])`, "i");
  return re.test(raw);
}

function buildPropertyTitle(
  rawAddress: string,
  suburb: string,
  addressStored: string,
): string {
  const raw = rawAddress.trim();
  const sub = suburb.trim();
  if (!sub) return addressStored;
  if (addressAlreadyContainsSuburb(raw, sub)) return raw;
  return `${addressStored}, ${sub}`;
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
  const inspectionSlots = parseInspectionDatesHidden(
    String(formData.get("inspectionDates") ?? ""),
  );
  const auctionDate = normalizeAuctionDate(
    String(formData.get("auctionDate") ?? ""),
  );
  const auctionTime = normalizeAuctionTime(
    String(formData.get("auctionTime") ?? ""),
  );
  const auctionVenue = String(formData.get("auctionVenue") ?? "").trim();

  if (!address) return { error: "Address is required." };
  if (!suburb) return { error: "Suburb is required." };

  const state = normalizeStateForDb(stateRaw);
  if (stateRaw && !state) {
    return { error: "Please choose a valid state or leave it blank." };
  }

  const addressStored = normalizeStoredAddressLine(
    address,
    suburb,
    state,
    postcode,
  );
  const title = buildPropertyTitle(address, suburb, addressStored);

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

  let imageUrlsExtra = parseImageUrlsFromForm(
    String(formData.get("imageUrls") ?? ""),
  );
  if (imageUrl) {
    imageUrlsExtra = imageUrlsExtra.filter((u) => u !== imageUrl);
  }
  for (const extra of imageUrlsExtra) {
    try {
      const u = new URL(extra);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { error: "Extra image URLs must be http(s)." };
      }
    } catch {
      return { error: "Each extra image URL must be valid." };
    }
  }

  console.log(
    "[createProperty] imageUrl:",
    imageUrl,
    "imageUrls count:",
    imageUrlsExtra?.length,
  );

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

  const auctionLine = buildAuctionNoteLine(
    auctionDate,
    auctionTime,
    auctionVenue,
  );
  const notesMerged = mergeNotesWithAuctionLine(auctionLine, notesRaw);

  let insertedId: string;
  let cacheDbUserId: string;
  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });
    cacheDbUserId = dbUser.id;

    const db = getDb();
    const agentId = await resolveOrCreateAgentId(db, dbUser.id, {
      agentName,
      agencyName,
      agentPhotoUrl,
      agentEmail,
      agentPhone,
    });

    const [inserted] = await db
      .insert(properties)
      .values({
        userId: dbUser.id,
        agentId,
        title,
        address: addressStored,
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
        imageUrls: imageUrlsExtra.length > 0 ? imageUrlsExtra : null,
        notes: notesMerged,
        auctionDate: auctionDate || null,
        auctionTime: auctionTime || null,
        auctionVenue: auctionVenue || null,
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

    if (inspectionSlots.length > 0) {
      await insertInspectionSlotsForProperty(
        db,
        dbUser.id,
        insertedId,
        inspectionSlots,
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { error: message || "Something went wrong. Try again." };
  }

  try {
    await invalidateUserCacheAfterPropertySave(
      cacheDbUserId,
      suburb,
      postcode,
      insertedId,
      state || "NSW",
    );
  } catch (e) {
    console.error("[properties] invalidateUserCacheAfterPropertySave:", e);
  }

  redirect(`/properties/${insertedId}`);
}

export type PropertyRecordInput = {
  address: string;
  suburb: string;
  state?: string;
  postcode?: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  propertyType: string | null;
  listingUrl: string;
  imageUrl: string | null;
  imageUrls: string[] | null;
  notes: string | null;
  agentName: string | null;
  agencyName: string | null;
  agentPhotoUrl?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  auctionDate?: string | null;
  auctionTime?: string | null;
  auctionVenue?: string | null;
  propertyStatus?: (typeof PROPERTY_STATUSES)[number];
};

/** Insert a property row (e.g. from discovery save) without FormData. */
export async function createPropertyRecordForUser(
  input: PropertyRecordInput,
): Promise<
  | { ok: true; id: string; address: string; userId: string }
  | { ok: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return {
      ok: false,
      error: "Your account needs an email address before you can save listings.",
    };
  }

  const address = coerceClaudeJsonString(input.address).trim();
  const suburb = coerceClaudeJsonString(input.suburb).trim();
  if (!address) return { ok: false, error: "Address is required." };
  if (!suburb) return { ok: false, error: "Suburb is required." };

  const state = normalizeStateForDb(coerceClaudeJsonString(input.state));
  const postcode = coerceClaudeJsonString(input.postcode).trim();
  const addressStored = normalizeStoredAddressLine(
    address,
    suburb,
    state,
    postcode,
  );
  const title = buildPropertyTitle(address, suburb, addressStored);
  const statusRaw = input.propertyStatus ?? "saved";
  if (!PROPERTY_STATUSES.includes(statusRaw)) {
    return { ok: false, error: "Invalid property status." };
  }
  const status = statusRaw;

  let listingUrl: string = coerceClaudeJsonString(input.listingUrl).trim();
  try {
    // eslint-disable-next-line no-new
    new URL(listingUrl);
  } catch {
    return { ok: false, error: "Listing URL must be valid." };
  }

  let imageUrl: string | null =
    coerceClaudeJsonString(input.imageUrl).trim() || null;
  if (imageUrl) {
    try {
      const u = new URL(imageUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "Image URL must be http(s)." };
      }
    } catch {
      return { ok: false, error: "Image URL must be valid." };
    }
  }

  let imageUrlsExtra = [...(input.imageUrls ?? [])]
    .map((u) => coerceClaudeJsonString(u).trim())
    .filter(Boolean);
  if (imageUrl) {
    imageUrlsExtra = imageUrlsExtra.filter((u) => u !== imageUrl);
  }
  imageUrlsExtra = imageUrlsExtra.slice(0, 7);
  for (const extra of imageUrlsExtra) {
    try {
      const u = new URL(extra);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "Extra image URLs must be http(s)." };
      }
    } catch {
      return { ok: false, error: "Each extra image URL must be valid." };
    }
  }

  const agentPhotoUrl =
    coerceClaudeJsonString(input.agentPhotoUrl).trim() || null;
  if (agentPhotoUrl) {
    try {
      const u = new URL(agentPhotoUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "Agent photo URL must be http(s)." };
      }
    } catch {
      return { ok: false, error: "Agent photo URL must be valid." };
    }
  }

  const agentName = coerceClaudeJsonString(input.agentName).trim() || null;
  const agencyName = coerceClaudeJsonString(input.agencyName).trim() || null;
  const agentEmail = coerceClaudeJsonString(input.agentEmail).trim() || null;
  const agentPhone = coerceClaudeJsonString(input.agentPhone).trim() || null;
  const notesRaw = coerceClaudeJsonString(input.notes).trim() || null;

  const auctionDate = normalizeAuctionDate(input.auctionDate);
  const auctionTime = normalizeAuctionTime(input.auctionTime);
  const auctionVenue = coerceClaudeJsonString(input.auctionVenue).trim();
  const auctionLine = buildAuctionNoteLine(
    auctionDate,
    auctionTime,
    auctionVenue,
  );
  const notesMerged = mergeNotesWithAuctionLine(auctionLine, notesRaw || "");

  const propertyTypeRaw = coerceClaudeJsonString(input.propertyType).trim();
  const propertyType = propertyTypeRaw
    ? normalizePropertyTypeForDb(propertyTypeRaw) ?? "Other"
    : null;

  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });

    const db = getDb();
    const agentId = await resolveOrCreateAgentId(db, dbUser.id, {
      agentName,
      agencyName,
      agentPhotoUrl,
      agentEmail,
      agentPhone,
    });

    const [inserted] = await db
      .insert(properties)
      .values({
        userId: dbUser.id,
        agentId,
        title,
        address: addressStored,
        suburb,
        state: state || "",
        postcode,
        price: input.price,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        parking: input.parking,
        propertyType,
        status,
        listingUrl,
        imageUrl,
        imageUrls: imageUrlsExtra.length > 0 ? imageUrlsExtra : null,
        notes: notesMerged,
        auctionDate: auctionDate || null,
        auctionTime: auctionTime || null,
        auctionVenue: auctionVenue || null,
        agentName,
        agencyName,
        agentPhotoUrl,
        agentEmail,
        agentPhone,
      })
      .returning({ id: properties.id });

    if (!inserted) {
      return { ok: false, error: "Could not save the property." };
    }

    try {
      await invalidateUserCacheAfterPropertySave(
        dbUser.id,
        suburb,
        postcode,
        inserted.id,
        state || "NSW",
      );
    } catch (e) {
      console.error("[properties] invalidateUserCacheAfterPropertySave:", e);
    }

    return {
      ok: true,
      id: inserted.id,
      address: addressStored,
      userId: dbUser.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: message || "Something went wrong." };
  }
}

export type UpdateAgentResult = { ok: true } | { ok: false; error: string };

export async function updateAgentDetails(
  formData: FormData,
): Promise<UpdateAgentResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) {
    return { ok: false, error: "Missing property." };
  }

  const agentNameRaw = String(formData.get("agentName") ?? "").trim();
  const agencyNameRaw = String(formData.get("agencyName") ?? "").trim();
  const agentPhotoUrlRaw = String(formData.get("agentPhotoUrl") ?? "").trim();
  const agentEmailRaw = String(formData.get("agentEmail") ?? "").trim();
  const agentPhoneRaw = String(formData.get("agentPhone") ?? "").trim();

  let agentPhotoUrl: string | null = agentPhotoUrlRaw || null;
  if (agentPhotoUrl) {
    try {
      const u = new URL(agentPhotoUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "Agent photo URL must be http(s)." };
      }
    } catch {
      return { ok: false, error: "Agent photo URL must be a valid URL." };
    }
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return {
      ok: false,
      error: "Your account needs an email address.",
    };
  }

  let linkedAgentId: string | null = null;

  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });

    const db = getDb();
    const agentId = await resolveOrCreateAgentId(db, dbUser.id, {
      agentName: agentNameRaw || null,
      agencyName: agencyNameRaw || null,
      agentPhotoUrl,
      agentEmail: agentEmailRaw || null,
      agentPhone: agentPhoneRaw || null,
    });
    linkedAgentId = agentId;

    const updated = await db
      .update(properties)
      .set({
        agentId,
        agentName: agentNameRaw || null,
        agencyName: agencyNameRaw || null,
        agentPhotoUrl,
        agentEmail: agentEmailRaw || null,
        agentPhone: agentPhoneRaw || null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
      )
      .returning({ id: properties.id });

    if (!updated.length) {
      return { ok: false, error: "Property not found or access denied." };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save.";
    return { ok: false, error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/agents");
  if (linkedAgentId) {
    revalidatePath(`/agents/${linkedAgentId}`);
  }
  revalidatePath(`/properties/${propertyId}`);

  return { ok: true };
}

export type UpdatePropertyStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updatePropertyStatus(
  propertyId: string,
  status: string,
): Promise<UpdatePropertyStatusResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }

  if (!isValidPropertyId(propertyId)) {
    return { ok: false, error: "Invalid property." };
  }

  const normalized = status.trim().toLowerCase();
  if (
    !PROPERTY_STATUSES.includes(
      normalized as (typeof PROPERTY_STATUSES)[number],
    )
  ) {
    return { ok: false, error: "Invalid status." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return { ok: false, error: "Your account needs an email address." };
  }

  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });
    const db = getDb();
    const updated = await db
      .update(properties)
      .set({
        status: normalized as (typeof PROPERTY_STATUSES)[number],
        updatedAt: new Date(),
      })
      .where(
        and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
      )
      .returning({ id: properties.id });

    if (!updated.length) {
      return { ok: false, error: "Property not found or access denied." };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update.";
    return { ok: false, error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/compare");
  revalidatePath(`/properties/${propertyId}`);

  return { ok: true };
}

export type DeletePropertyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteProperty(
  propertyId: string,
): Promise<DeletePropertyResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database is not configured." };
  }
  if (!isValidPropertyId(propertyId)) {
    return { ok: false, error: "Invalid property." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return { ok: false, error: "Your account needs an email address." };
  }

  let dbUserIdForBriefing: string;
  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId: userId,
      email,
      name: clerkUser?.fullName ?? null,
    });
    dbUserIdForBriefing = dbUser.id;
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .delete(propertyEmails)
        .where(
          and(
            eq(propertyEmails.propertyId, propertyId),
            eq(propertyEmails.userId, dbUser.id),
          ),
        );
      const gone = await tx
        .delete(properties)
        .where(
          and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
        )
        .returning({ id: properties.id });
      if (!gone.length) {
        throw new Error("Property not found or access denied.");
      }
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not delete property.";
    return { ok: false, error: message };
  }

  try {
    await deleteTodaysBriefingsForDbUser(dbUserIdForBriefing);
  } catch (e) {
    console.error("[properties] deleteTodaysBriefingsForDbUser:", e);
  }

  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/compare");
  revalidatePath("/planner");
  revalidatePath("/agents");
  revalidatePath("/agent");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}
