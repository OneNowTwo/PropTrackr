"use server";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  inspections,
  properties,
  propertyEmails,
  users,
  voiceNotes,
} from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";

export type ActivityItem = {
  id: string;
  type: "property_saved" | "inspection_attended" | "voice_note" | "email";
  description: string;
  href: string;
  timestamp: string;
};

function relativeTime(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (!userRow) return [];

    const userId = userRow.id;

    const [recentProps, recentInspections, recentVoiceNotes, recentEmails] =
      await Promise.all([
        db
          .select({
            id: properties.id,
            address: properties.address,
            suburb: properties.suburb,
            createdAt: properties.createdAt,
          })
          .from(properties)
          .where(eq(properties.userId, userId))
          .orderBy(desc(properties.createdAt))
          .limit(5),
        db
          .select({
            id: inspections.id,
            propertyId: inspections.propertyId,
            inspectionDate: inspections.inspectionDate,
            propAddress: properties.address,
          })
          .from(inspections)
          .innerJoin(properties, eq(inspections.propertyId, properties.id))
          .where(eq(inspections.userId, userId))
          .orderBy(desc(inspections.inspectionDate))
          .limit(5),
        db
          .select({
            id: voiceNotes.id,
            propertyId: voiceNotes.propertyId,
            createdAt: voiceNotes.createdAt,
            propAddress: properties.address,
          })
          .from(voiceNotes)
          .innerJoin(properties, eq(voiceNotes.propertyId, properties.id))
          .where(eq(voiceNotes.userId, userId))
          .orderBy(desc(voiceNotes.createdAt))
          .limit(5),
        db
          .select({
            id: propertyEmails.id,
            propertyId: propertyEmails.propertyId,
            fromName: propertyEmails.fromName,
            receivedAt: propertyEmails.receivedAt,
            propAddress: properties.address,
          })
          .from(propertyEmails)
          .leftJoin(properties, eq(propertyEmails.propertyId, properties.id))
          .where(eq(propertyEmails.userId, userId))
          .orderBy(desc(propertyEmails.receivedAt))
          .limit(5),
      ]);

    const all: ActivityItem[] = [];

    for (const p of recentProps) {
      all.push({
        id: `prop-${p.id}`,
        type: "property_saved",
        description: `${p.address}, ${p.suburb} saved`,
        href: `/properties/${p.id}`,
        timestamp: relativeTime(p.createdAt),
      });
    }

    for (const i of recentInspections) {
      all.push({
        id: `insp-${i.id}`,
        type: "inspection_attended",
        description: `Inspection: ${i.propAddress}`,
        href: `/properties/${i.propertyId}`,
        timestamp: relativeTime(i.inspectionDate),
      });
    }

    for (const v of recentVoiceNotes) {
      all.push({
        id: `voice-${v.id}`,
        type: "voice_note",
        description: `Voice note added to ${v.propAddress}`,
        href: `/properties/${v.propertyId}`,
        timestamp: relativeTime(v.createdAt),
      });
    }

    for (const e of recentEmails) {
      const from = e.fromName ?? "Unknown";
      const addr = e.propAddress ?? "a property";
      all.push({
        id: `email-${e.id}`,
        type: "email",
        description: `Email from ${from} re ${addr}`,
        href: e.propertyId ? `/properties/${e.propertyId}` : "/account",
        timestamp: relativeTime(e.receivedAt),
      });
    }

    all.sort((a, b) => {
      const ta = extractMs(a);
      const tb = extractMs(b);
      return tb - ta;
    });

    return all.slice(0, 5);
  } catch (e) {
    console.error("[activity] error:", e);
    return [];
  }
}

function extractMs(item: ActivityItem): number {
  const t = item.timestamp;
  if (t === "Just now") return Date.now();
  if (t === "Yesterday") return Date.now() - 86_400_000;
  const mMatch = t.match(/^(\d+)m ago$/);
  if (mMatch) return Date.now() - Number(mMatch[1]) * 60_000;
  const hMatch = t.match(/^(\d+)h ago$/);
  if (hMatch) return Date.now() - Number(hMatch[1]) * 3_600_000;
  const dMatch = t.match(/^(\d+) days ago$/);
  if (dMatch) return Date.now() - Number(dMatch[1]) * 86_400_000;
  return 0;
}
