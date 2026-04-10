"use server";

import { and, count, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  comparisons,
  gmailConnections,
  inspections,
  properties,
  propertyNotes,
  users,
} from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";

export type ChecklistPriority = "urgent" | "upcoming" | "action";

export type ChecklistItem = {
  id: string;
  title: string;
  subtitle?: string;
  priority: ChecklistPriority;
  href: string;
  type: string;
};

export async function getChecklistItems(): Promise<ChecklistItem[]> {
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
    const hhIds = await getHouseholdUserIds(userId);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const items: ChecklistItem[] = [];

    const [
      allProps,
      upcomingInspections,
      attendedInspections,
      notesForProps,
      gmailRow,
      shortlistedCount,
      comparisonCount,
      partnerRecentProps,
    ] = await Promise.all([
      db
        .select({
          id: properties.id,
          address: properties.address,
          suburb: properties.suburb,
          imageUrl: properties.imageUrl,
          imageUrls: properties.imageUrls,
          status: properties.status,
          auctionDate: properties.auctionDate,
          auctionTime: properties.auctionTime,
          agentName: properties.agentName,
        })
        .from(properties)
        .where(inArray(properties.userId, hhIds)),
      db
        .select({
          id: inspections.id,
          propertyId: inspections.propertyId,
          inspectionDate: inspections.inspectionDate,
          inspectionTime: inspections.inspectionTime,
          attended: inspections.attended,
        })
        .from(inspections)
        .where(
          and(inArray(inspections.userId, hhIds), gte(inspections.inspectionDate, now)),
        ),
      db
        .select({
          id: inspections.id,
          propertyId: inspections.propertyId,
          inspectionDate: inspections.inspectionDate,
          attended: inspections.attended,
        })
        .from(inspections)
        .where(
          and(
            inArray(inspections.userId, hhIds),
            eq(inspections.attended, true),
            gte(inspections.inspectionDate, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
          ),
        ),
      db
        .select({ propertyId: propertyNotes.propertyId })
        .from(propertyNotes)
        .where(inArray(propertyNotes.userId, hhIds)),
      db
        .select({ id: gmailConnections.id })
        .from(gmailConnections)
        .where(eq(gmailConnections.userId, userId))
        .limit(1),
      db
        .select({ c: count() })
        .from(properties)
        .where(and(inArray(properties.userId, hhIds), eq(properties.status, "shortlisted"))),
      db.select({ c: count() }).from(comparisons).where(inArray(comparisons.userId, hhIds)),
      hhIds.length > 1
        ? db
            .select({
              id: properties.id,
              address: properties.address,
              userName: users.name,
            })
            .from(properties)
            .innerJoin(users, eq(properties.userId, users.id))
            .where(
              and(
                ne(properties.userId, userId),
                inArray(properties.userId, hhIds),
                gte(properties.createdAt, new Date(now.getTime() - 48 * 60 * 60 * 1000)),
              ),
            )
            .orderBy(desc(properties.createdAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

    const propsById = new Map(allProps.map((p) => [p.id, p]));
    const propsWithNotes = new Set(notesForProps.map((n) => n.propertyId));

    // --- URGENT: auctions today/tomorrow ---
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    for (const p of allProps) {
      if (!p.auctionDate) continue;
      if (p.auctionDate === todayStr) {
        items.push({
          id: `auction-today-${p.id}`,
          title: `Auction today: ${p.address}`,
          subtitle: p.auctionTime ? `at ${p.auctionTime}` : undefined,
          priority: "urgent",
          href: `/properties/${p.id}`,
          type: "auction",
        });
      } else if (p.auctionDate === tomorrowStr) {
        items.push({
          id: `auction-tomorrow-${p.id}`,
          title: `Auction tomorrow: ${p.address}`,
          subtitle: p.auctionTime ? `at ${p.auctionTime}` : undefined,
          priority: "urgent",
          href: `/properties/${p.id}`,
          type: "auction",
        });
      }
    }

    // --- URGENT: inspections within 24h ---
    for (const insp of upcomingInspections) {
      const inspDate = new Date(insp.inspectionDate);
      const prop = propsById.get(insp.propertyId);
      if (inspDate <= in24h) {
        const hoursAway = Math.max(1, Math.round((inspDate.getTime() - now.getTime()) / 3_600_000));
        items.push({
          id: `insp-urgent-${insp.id}`,
          title: `Inspection in ${hoursAway}h: ${prop?.address ?? "Property"}`,
          subtitle: insp.inspectionTime,
          priority: "urgent",
          href: "/planner",
          type: "inspection",
        });
      }
    }

    // --- UPCOMING: inspections in next 7 days ---
    for (const insp of upcomingInspections) {
      const inspDate = new Date(insp.inspectionDate);
      if (inspDate > in24h && inspDate <= in7d) {
        const prop = propsById.get(insp.propertyId);
        const dayLabel = inspDate.toLocaleDateString("en-AU", { weekday: "long" });
        items.push({
          id: `insp-upcoming-${insp.id}`,
          title: `Inspection on ${dayLabel}: ${prop?.address ?? "Property"}`,
          subtitle: insp.inspectionTime,
          priority: "upcoming",
          href: "/planner",
          type: "inspection",
        });
      }
    }

    // --- UPCOMING: auctions in next 7 days ---
    for (const p of allProps) {
      if (!p.auctionDate || p.auctionDate === todayStr || p.auctionDate === tomorrowStr) continue;
      const ad = new Date(p.auctionDate + "T00:00:00");
      if (ad > in48h && ad <= in7d) {
        const daysAway = Math.ceil((ad.getTime() - now.getTime()) / 86_400_000);
        items.push({
          id: `auction-upcoming-${p.id}`,
          title: `Auction in ${daysAway} days: ${p.address}`,
          subtitle: p.auctionTime ? `at ${p.auctionTime}` : undefined,
          priority: "upcoming",
          href: `/properties/${p.id}`,
          type: "auction",
        });
      }
    }

    // --- UPCOMING: follow up agent after attended inspection ---
    for (const insp of attendedInspections) {
      const prop = propsById.get(insp.propertyId);
      if (!prop || propsWithNotes.has(insp.propertyId)) continue;
      const inspDate = new Date(insp.inspectionDate);
      if (now.getTime() - inspDate.getTime() > 48 * 60 * 60 * 1000 && prop.agentName) {
        items.push({
          id: `followup-${insp.id}`,
          title: `Follow up ${prop.agentName}`,
          subtitle: `re ${prop.address}`,
          priority: "upcoming",
          href: `/properties/${prop.id}`,
          type: "followup",
        });
      }
    }

    // --- ACTION: add photos ---
    for (const p of allProps) {
      const hasImages = p.imageUrl || (p.imageUrls && p.imageUrls.length > 0);
      if (!hasImages) {
        items.push({
          id: `photos-${p.id}`,
          title: `Add photos to ${p.address}`,
          priority: "action",
          href: `/properties/${p.id}`,
          type: "photos",
        });
      }
    }

    // --- ACTION: add notes after attended inspection ---
    for (const insp of attendedInspections) {
      if (!propsWithNotes.has(insp.propertyId)) {
        const prop = propsById.get(insp.propertyId);
        if (prop && !items.some((i) => i.id === `followup-${insp.id}`)) {
          items.push({
            id: `notes-${insp.id}`,
            title: `Add notes after inspection`,
            subtitle: prop.address,
            priority: "action",
            href: `/properties/${prop.id}`,
            type: "notes",
          });
        }
      }
    }

    // --- ACTION: compare shortlisted ---
    const sc = Number(shortlistedCount[0]?.c ?? 0);
    const cc = Number(comparisonCount[0]?.c ?? 0);
    if (sc >= 2 && cc === 0) {
      items.push({
        id: "compare-shortlisted",
        title: "Compare shortlisted properties",
        subtitle: `${sc} properties ready to compare`,
        priority: "action",
        href: "/compare",
        type: "compare",
      });
    }

    // --- ACTION: connect Gmail ---
    if (!gmailRow.length) {
      items.push({
        id: "connect-gmail",
        title: "Sync your Gmail",
        subtitle: "Get agent emails linked to properties automatically",
        priority: "action",
        href: "/account",
        type: "gmail",
      });
    }

    // --- ACTION: onboarding ---
    if (allProps.length === 0) {
      items.push({
        id: "first-property",
        title: "Save your first property",
        subtitle: "Use the Chrome extension on realestate.com.au",
        priority: "action",
        href: "/properties/new",
        type: "onboarding",
      });
    } else if (allProps.length < 2) {
      items.push({
        id: "install-extension",
        title: "Install the Chrome extension",
        subtitle: "Save properties from REA in one click",
        priority: "action",
        href: "/properties/new",
        type: "onboarding",
      });
    }

    // --- UPCOMING: partner recently saved properties ---
    for (const pp of partnerRecentProps) {
      const firstName = pp.userName?.split(/\s+/)[0] ?? "Partner";
      items.push({
        id: `partner-prop-${pp.id}`,
        title: `${firstName} saved a new property`,
        subtitle: pp.address,
        priority: "upcoming",
        href: `/properties/${pp.id}`,
        type: "partner",
      });
    }

    // Sort: urgent > upcoming > action
    const priorityOrder: Record<ChecklistPriority, number> = { urgent: 0, upcoming: 1, action: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items;
  } catch (e) {
    console.error("[checklist] error:", e);
    return [];
  }
}
