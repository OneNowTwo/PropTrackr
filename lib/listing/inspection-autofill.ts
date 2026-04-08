import { inspections } from "@/lib/db/schema";
import { coerceClaudeJsonString } from "@/lib/listing/coerce-claude-json-string";
import { INSPECTION_DURATION_OPTIONS } from "@/lib/property-detail-constants";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type Db = PostgresJsDatabase<typeof schema>;

export type InspectionDateSlot = {
  date: string;
  startTime: string;
  endTime: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Normalise "9:30" or "09:30" to HH:MM. */
export function normalizeTimeHHMM(raw: string): string | null {
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const min = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    return null;
  }
  return `${pad2(h)}:${pad2(min)}`;
}

export function normalizeInspectionDatesFromExtract(
  raw: unknown,
): InspectionDateSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: InspectionDateSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const date = coerceClaudeJsonString(o.date).trim();
    const startRaw = coerceClaudeJsonString(o.startTime).trim();
    const endRaw = coerceClaudeJsonString(o.endTime).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const startTime = normalizeTimeHHMM(startRaw);
    if (!startTime) continue;
    const endTime = endRaw ? normalizeTimeHHMM(endRaw) ?? "" : "";
    out.push({ date, startTime, endTime });
    if (out.length >= 20) break;
  }
  return out;
}

function durationMinutesForSlot(startTime: string, endTime: string): number {
  if (!endTime) return 30;
  const [sh, sm] = startTime.split(":").map((x) => Number.parseInt(x, 10));
  const [eh, em] = endTime.split(":").map((x) => Number.parseInt(x, 10));
  if (
    !Number.isFinite(sh) ||
    !Number.isFinite(sm) ||
    !Number.isFinite(eh) ||
    !Number.isFinite(em)
  ) {
    return 30;
  }
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (!Number.isFinite(diff) || diff <= 0) diff = 30;
  const allowed = [...INSPECTION_DURATION_OPTIONS];
  return allowed.reduce((best, cur) =>
    Math.abs(cur - diff) < Math.abs(best - diff) ? cur : best,
  );
}

export async function insertInspectionSlotsForProperty(
  db: Db,
  userId: string,
  propertyId: string,
  slots: InspectionDateSlot[],
): Promise<void> {
  for (const slot of slots) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slot.date);
    if (!m) continue;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const inspectionDate = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
    const durationMinutes = durationMinutesForSlot(
      slot.startTime,
      slot.endTime,
    );
    await db.insert(inspections).values({
      propertyId,
      userId,
      inspectionDate,
      inspectionTime: slot.startTime,
      durationMinutes,
      attended: false,
      notes: null,
    });
  }
}

export function normalizeAuctionDate(raw: unknown): string {
  const t = coerceClaudeJsonString(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  return t;
}

export function normalizeAuctionTime(raw: unknown): string {
  return normalizeTimeHHMM(coerceClaudeJsonString(raw)) ?? "";
}

export function buildAuctionNoteLine(
  auctionDate: string,
  auctionTime: string,
  auctionVenue: string,
): string | null {
  if (!auctionDate) return null;
  let s = `🔨 Auction: ${auctionDate}`;
  if (auctionTime) s += ` at ${auctionTime}`;
  const v = auctionVenue.trim();
  if (v) s += `, ${v}`;
  return s;
}

export function mergeNotesWithAuctionLine(
  auctionLine: string | null,
  userNotes: string,
): string | null {
  const u = userNotes.trim();
  if (!auctionLine) return u || null;
  if (!u) return auctionLine;
  return `${auctionLine}\n\n${u}`;
}
