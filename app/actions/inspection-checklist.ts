"use server";

import Anthropic from "@anthropic-ai/sdk";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";
import { isValidPropertyId } from "@/lib/db/queries";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  fetchFreshInspectionChecklist,
  fetchInspectionChecklistRowAny,
} from "@/lib/db/inspection-checklist-queries";
import { inspectionChecklists, properties, users } from "@/lib/db/schema";
import type {
  InspectionChecklistItem,
  InspectionChecklistPayload,
} from "@/lib/inspection-checklist/types";
import { formatAud } from "@/lib/utils";

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: key });
}

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

async function assertCanAccessProperty(
  dbUserId: string,
  propertyId: string,
): Promise<(typeof properties.$inferSelect) | null> {
  if (!isValidPropertyId(propertyId)) return null;
  const db = getDb();
  const hhIds = await getHouseholdUserIds(dbUserId);
  const [p] = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        inArray(properties.userId, hhIds),
      ),
    )
    .limit(1);
  return p ?? null;
}

function parseItemsFromClaude(text: string): InspectionChecklistItem[] {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }
  const jsonMatch = t.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const raw = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(raw)) return [];
    const out: InspectionChecklistItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const id =
        typeof o.id === "string" && o.id.trim()
          ? o.id.trim()
          : `item-${out.length}-${Date.now()}`;
      const category =
        typeof o.category === "string" && o.category.trim()
          ? o.category.trim()
          : "General";
      const itemText =
        typeof o.text === "string" && o.text.trim() ? o.text.trim() : "";
      if (!itemText) continue;
      const pr = o.priority;
      const priority: InspectionChecklistItem["priority"] =
        pr === "high" || pr === "medium" || pr === "low" ? pr : "medium";
      const hint =
        typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : undefined;
      out.push({
        id,
        category,
        text: itemText,
        checked: false,
        priority,
        hint,
      });
    }
    return out.slice(0, 40);
  } catch {
    return [];
  }
}

function propertySnapshotFromRow(
  p: typeof properties.$inferSelect,
): Record<string, unknown> {
  return {
    address: p.address,
    suburb: p.suburb,
    state: p.state,
    postcode: p.postcode,
    propertyType: p.propertyType,
    price: p.price,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    landSize: p.landSize,
    notes: p.notes?.slice(0, 800) ?? null,
    title: p.title,
    auctionDate: p.auctionDate,
  };
}

export async function generateInspectionChecklist(
  propertyId: string,
): Promise<
  | { ok: true; checklist: InspectionChecklistPayload }
  | { ok: false; error: string }
> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return { ok: false, error: "Sign in required." };
  const p = await assertCanAccessProperty(dbUserId, propertyId);
  if (!p) return { ok: false, error: "Property not found." };

  const notesSummary = (p.notes ?? "").trim().slice(0, 600);
  const priceLabel = formatAud(p.price);
  const combinedText = `${p.title} ${p.notes ?? ""} ${p.propertyType ?? ""}`.toLowerCase();
  const poolMentioned = /\bpool\b|swimming\s*pool|spa\b/i.test(combinedText);
  const notesLower = notesSummary.toLowerCase();
  const ageHint =
    /\b19\d{2}\b|\b20[0-2]\d\b|circa|original|period|postwar|weatherboard\s+classic/i.test(
      notesLower,
    )
      ? "Listing or notes suggest possible older / period construction — include wiring, asbestos awareness, and building fabric items where relevant."
      : "Use property type and price band to infer likely build era; include age-appropriate items if it may be pre-1990s.";

  const userMsg = `Generate a detailed inspection checklist for this property:
Address: ${p.address}, ${p.suburb} ${p.state} ${p.postcode}
Type: ${p.propertyType ?? "Not specified"}
Price: ${priceLabel}
Bedrooms: ${p.bedrooms ?? "—"}, Bathrooms: ${p.bathrooms ?? "—"}
Parking: ${p.parking ?? "—"}
Land size (sqm): ${p.landSize ?? "—"}
Notes from listing: ${notesSummary || "(none)"}
Suburb: ${p.suburb}
Pool or spa mentioned: ${poolMentioned ? "yes" : "no"}
${ageHint}

Generate 20-30 checklist items organised into these categories:
- Structure & Building (roof, walls, foundations, windows)
- Water & Moisture (wet areas, drainage, signs of damp)
- Electrical & Plumbing (switchboard, hot water, taps)
- Interior (floors, ceilings, doors, storage)
- Exterior & Garden (fencing, driveway, outdoor areas)
- Strata/Building specific (if apartment/unit/townhouse)
- Location & Neighbours (noise, parking, access)
- Questions to Ask Agent (price guide, interest, offers)

For each item return JSON objects in a single array:
{
  "id": "unique string",
  "category": "string",
  "text": "the checklist item",
  "priority": "high" | "medium" | "low",
  "hint": "optional — why this matters for this property"
}

Tailor to this property type and price point. For apartments/units/townhouses include strata-specific items. For older properties include wiring, asbestos awareness, and building movement. For pools include compliance/fencing/safety items.

Return ONLY a JSON array, no other text.`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4_096,
    system:
      "You are an expert Australian property inspector and buyers agent. Generate a practical inspection checklist. Output must be valid JSON only: a single array of objects.",
    messages: [{ role: "user", content: userMsg }],
  });
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const items = parseItemsFromClaude(text);
  if (items.length === 0) {
    return { ok: false, error: "Could not generate checklist. Try again." };
  }

  const snapshot = propertySnapshotFromRow(p);
  const db = getDb();
  const existing = await fetchInspectionChecklistRowAny(dbUserId, propertyId);

  if (existing) {
    await db
      .update(inspectionChecklists)
      .set({
        items,
        generatedAt: new Date(),
        propertySnapshot: snapshot,
      })
      .where(eq(inspectionChecklists.id, existing.id));
  } else {
    await db.insert(inspectionChecklists).values({
      propertyId,
      userId: dbUserId,
      items,
      propertySnapshot: snapshot,
    });
  }

  const fresh = await fetchFreshInspectionChecklist(dbUserId, propertyId);
  if (!fresh) {
    return { ok: false, error: "Saved checklist could not be loaded." };
  }

  revalidatePath(`/properties/${propertyId}`);
  return {
    ok: true,
    checklist: {
      rowId: fresh.rowId,
      items: fresh.items,
      generatedAt: fresh.generatedAt.toISOString(),
    },
  };
}

export async function getInspectionChecklist(
  propertyId: string,
): Promise<InspectionChecklistPayload | null> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return null;
  const p = await assertCanAccessProperty(dbUserId, propertyId);
  if (!p) return null;
  const fresh = await fetchFreshInspectionChecklist(dbUserId, propertyId);
  if (!fresh) return null;
  return {
    rowId: fresh.rowId,
    items: fresh.items,
    generatedAt: fresh.generatedAt.toISOString(),
  };
}

export async function updateChecklistItem(
  propertyId: string,
  itemId: string,
  checked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return { ok: false, error: "Sign in required." };
  const p = await assertCanAccessProperty(dbUserId, propertyId);
  if (!p) return { ok: false, error: "Not found." };

  const row = await fetchInspectionChecklistRowAny(dbUserId, propertyId);
  if (!row) return { ok: false, error: "No checklist." };

  const raw = row.items;
  const list = Array.isArray(raw) ? [...raw] : [];
  let changed = false;
  const next = list.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const o = entry as Record<string, unknown>;
    if (o.id === itemId) {
      changed = true;
      return { ...o, checked };
    }
    return entry;
  });
  if (!changed) return { ok: false, error: "Item not found." };

  const db = getDb();
  await db
    .update(inspectionChecklists)
    .set({ items: next })
    .where(eq(inspectionChecklists.id, row.id));
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function setChecklistCategoryChecked(
  propertyId: string,
  category: string,
  checked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return { ok: false, error: "Sign in required." };
  const p = await assertCanAccessProperty(dbUserId, propertyId);
  if (!p) return { ok: false, error: "Not found." };
  const row = await fetchInspectionChecklistRowAny(dbUserId, propertyId);
  if (!row) return { ok: false, error: "No checklist." };

  const list = Array.isArray(row.items) ? [...row.items] : [];
  const next = list.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const o = entry as Record<string, unknown>;
    if (o.category === category) return { ...o, checked };
    return entry;
  });

  const db = getDb();
  await db
    .update(inspectionChecklists)
    .set({ items: next })
    .where(eq(inspectionChecklists.id, row.id));
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function resetInspectionChecklistChecks(
  propertyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return { ok: false, error: "Sign in required." };
  const p = await assertCanAccessProperty(dbUserId, propertyId);
  if (!p) return { ok: false, error: "Not found." };
  const row = await fetchInspectionChecklistRowAny(dbUserId, propertyId);
  if (!row) return { ok: false, error: "No checklist." };

  const list = Array.isArray(row.items) ? [...row.items] : [];
  const next = list.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const o = entry as { checked?: boolean } & object;
    return { ...o, checked: false };
  });

  const db = getDb();
  await db
    .update(inspectionChecklists)
    .set({ items: next })
    .where(eq(inspectionChecklists.id, row.id));
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}
