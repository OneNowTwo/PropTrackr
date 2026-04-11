"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";
import {
  assertAgentOwnedByUser,
  assertPropertyOwnedByUser,
  fetchSaleResultsForProperty,
  fetchSaleResultsForSuburb,
  fetchSaleResultsForUser,
  type SaleResultWithAgent,
} from "@/lib/db/sale-results-queries";
import { propertySaleResults, users } from "@/lib/db/schema";

const SALE_TYPES = new Set(["auction", "private_treaty", "expression_of_interest"]);
const PROPERTY_TYPES = new Set(["house", "unit", "townhouse", "apartment"]);

export type AddSaleResultInput = {
  address: string;
  suburb: string;
  postcode: string;
  propertyType?: string | null;
  bedrooms?: number | null;
  salePrice: number;
  saleDate: string;
  saleType?: string | null;
  reservePrice?: number | null;
  passedIn?: boolean;
  daysOnMarket?: number | null;
  agentId?: string | null;
  notes?: string | null;
  propertyId?: string | null;
  source?: string | null;
};

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

function normalizeSaleType(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "private_treaty" || s === "private treaty") return "private_treaty";
  if (s === "eoi" || s === "expression_of_interest") return "expression_of_interest";
  if (s === "auction") return "auction";
  return SALE_TYPES.has(s) ? s : null;
}

function normalizePropertyType(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim().toLowerCase();
  return PROPERTY_TYPES.has(s) ? s : null;
}

function isValidIsoDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(`${d}T12:00:00`);
  return !Number.isNaN(t);
}

export async function addSaleResult(
  data: AddSaleResultInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) {
    return { ok: false, error: "You must be signed in." };
  }

  const suburb = data.suburb?.trim() ?? "";
  const postcode = data.postcode?.trim() ?? "";
  if (!suburb || !postcode) {
    return { ok: false, error: "Suburb and postcode are required." };
  }

  const address = (data.address?.trim() ?? "") || "—";
  const saleDate = data.saleDate?.trim() ?? "";
  if (!isValidIsoDate(saleDate)) {
    return { ok: false, error: "Please enter a valid sale date." };
  }

  const salePrice = Number(data.salePrice);
  if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice > 2_000_000_000) {
    return { ok: false, error: "Enter a valid sale price." };
  }

  let propertyId: string | null = null;
  if (data.propertyId?.trim()) {
    const ok = await assertPropertyOwnedByUser(data.propertyId.trim(), dbUserId);
    if (!ok) {
      return { ok: false, error: "Linked property not found." };
    }
    propertyId = data.propertyId.trim();
  }

  let agentId: string | null = null;
  if (data.agentId?.trim()) {
    const ok = await assertAgentOwnedByUser(data.agentId.trim(), dbUserId);
    if (!ok) {
      return { ok: false, error: "Agent not found." };
    }
    agentId = data.agentId.trim();
  }

  const saleType = normalizeSaleType(data.saleType ?? null);
  const propertyType = normalizePropertyType(data.propertyType ?? null);

  let reservePrice: number | null = null;
  if (data.reservePrice != null && Number.isFinite(Number(data.reservePrice))) {
    const r = Math.round(Number(data.reservePrice));
    if (r <= 0) {
      return { ok: false, error: "Reserve price is invalid." };
    }
    reservePrice = r;
  }

  let bedrooms: number | null = null;
  if (data.bedrooms != null && Number.isFinite(Number(data.bedrooms))) {
    const b = Math.round(Number(data.bedrooms));
    if (b < 0 || b > 50) {
      return { ok: false, error: "Bedrooms must be between 0 and 50." };
    }
    bedrooms = b;
  }

  let daysOnMarket: number | null = null;
  if (data.daysOnMarket != null && Number.isFinite(Number(data.daysOnMarket))) {
    const d = Math.round(Number(data.daysOnMarket));
    if (d < 0 || d > 10_000) {
      return { ok: false, error: "Days on market is invalid." };
    }
    daysOnMarket = d;
  }

  const passedIn = saleType === "auction" ? Boolean(data.passedIn) : false;
  if (saleType !== "auction") {
    reservePrice = null;
  }

  const notes = data.notes?.trim() || null;
  if (notes && notes.length > 8000) {
    return { ok: false, error: "Notes are too long." };
  }

  const sourceRaw = (data.source?.trim() || "manual").toLowerCase();
  const source = sourceRaw === "auto" ? "auto" : "manual";

  try {
    const db = getDb();
    const [inserted] = await db
      .insert(propertySaleResults)
      .values({
        userId: dbUserId,
        propertyId,
        address,
        suburb,
        postcode,
        propertyType,
        bedrooms,
        salePrice: Math.round(salePrice),
        saleDate,
        saleType,
        reservePrice,
        passedIn,
        daysOnMarket,
        agentId,
        notes,
        source,
      })
      .returning({ id: propertySaleResults.id });

    if (!inserted) {
      return { ok: false, error: "Could not save sale result." };
    }

    revalidatePath("/market");
    revalidatePath("/properties");
    if (propertyId) {
      revalidatePath(`/properties/${propertyId}`);
    }
    revalidatePath("/suburbs");
    return { ok: true, id: inserted.id };
  } catch (e) {
    console.error("[price-tracking] addSaleResult:", e);
    return { ok: false, error: "Could not save sale result." };
  }
}

/** All logged sale results for the signed-in user. */
export async function getSaleResults(): Promise<SaleResultWithAgent[]> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return [];
  try {
    return await fetchSaleResultsForUser(dbUserId);
  } catch {
    return [];
  }
}

/** Filtered by suburb + postcode for the signed-in user. */
export async function getSuburbSaleResults(
  suburb: string,
  postcode: string,
): Promise<SaleResultWithAgent[]> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return [];
  const s = suburb?.trim() ?? "";
  const pc = postcode?.trim() ?? "";
  if (!s || !pc) return [];
  try {
    return await fetchSaleResultsForSuburb(dbUserId, s, pc);
  } catch {
    return [];
  }
}

/** Results linked to a property (signed-in user only). */
export async function getSaleResultsForProperty(
  propertyId: string,
): Promise<SaleResultWithAgent[]> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return [];
  try {
    return await fetchSaleResultsForProperty(dbUserId, propertyId);
  } catch {
    return [];
  }
}

export async function deleteSaleResult(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) {
    return { ok: false, error: "You must be signed in." };
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: propertySaleResults.id,
        propertyId: propertySaleResults.propertyId,
      })
      .from(propertySaleResults)
      .where(
        and(eq(propertySaleResults.id, id), eq(propertySaleResults.userId, dbUserId)),
      )
      .limit(1);
    if (!row) {
      return { ok: false, error: "Sale result not found." };
    }

    await db.delete(propertySaleResults).where(eq(propertySaleResults.id, id));
    revalidatePath("/market");
    revalidatePath("/properties");
    if (row.propertyId) {
      revalidatePath(`/properties/${row.propertyId}`);
    }
    revalidatePath("/suburbs");
    return { ok: true };
  } catch (e) {
    console.error("[price-tracking] deleteSaleResult:", e);
    return { ok: false, error: "Could not delete." };
  }
}
