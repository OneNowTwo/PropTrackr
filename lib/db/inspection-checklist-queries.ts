import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { inspectionChecklists } from "@/lib/db/schema";
import type { InspectionChecklistItem } from "@/lib/inspection-checklist/types";
import { isValidPropertyId } from "@/lib/db/queries";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeItems(raw: unknown): InspectionChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InspectionChecklistItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const category = typeof o.category === "string" ? o.category : "General";
    const text = typeof o.text === "string" ? o.text : "";
    if (!id || !text.trim()) continue;
    const pr = o.priority;
    const priority: InspectionChecklistItem["priority"] =
      pr === "high" || pr === "low" || pr === "medium" ? pr : "medium";
    const checked = Boolean(o.checked);
    const hint =
      typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : undefined;
    out.push({ id, category, text, checked, priority, hint });
  }
  return out;
}

/** Checklist row if one exists and was generated within the last 7 days. */
export async function fetchFreshInspectionChecklist(
  dbUserId: string,
  propertyId: string,
): Promise<{
  rowId: string;
  items: InspectionChecklistItem[];
  generatedAt: Date;
} | null> {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(inspectionChecklists)
    .where(
      and(
        eq(inspectionChecklists.propertyId, propertyId),
        eq(inspectionChecklists.userId, dbUserId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const cutoff = new Date(Date.now() - FRESH_MS);
  if (row.generatedAt < cutoff) return null;
  return {
    rowId: row.id,
    items: normalizeItems(row.items),
    generatedAt: row.generatedAt,
  };
}

/** Any row (including stale) for regenerate flows — caller decides. */
export async function fetchInspectionChecklistRowAny(
  dbUserId: string,
  propertyId: string,
) {
  if (!process.env.DATABASE_URL || !isValidPropertyId(propertyId)) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(inspectionChecklists)
    .where(
      and(
        eq(inspectionChecklists.propertyId, propertyId),
        eq(inspectionChecklists.userId, dbUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}
