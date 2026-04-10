import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CommandCentre } from "@/components/agent/command-centre";
import { getChecklistItems } from "@/app/actions/checklist";
import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import { getAgentsWithPropertyCountsForClerkSafe } from "@/lib/db/agent-queries";
import { getFollowedSuburbs } from "@/app/actions/suburbs";
import {
  agentConversations,
  agentInsights,
  inspections,
  properties,
  users,
} from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";

export const metadata = { title: "Buyers Aigent | PropTrackr" };

async function getData(clerkId: string) {
  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return null;

  const hhIds = await getHouseholdUserIds(u.id);
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    convoRows,
    checklist,
    propsRaw,
    inspRaw,
    agentsRaw,
    suburbsRaw,
    insightsRaw,
  ] = await Promise.all([
    db
      .select()
      .from(agentConversations)
      .where(eq(agentConversations.userId, u.id))
      .orderBy(desc(agentConversations.updatedAt))
      .limit(1),
    getChecklistItems(),
    db
      .select()
      .from(properties)
      .where(inArray(properties.userId, hhIds))
      .orderBy(desc(properties.updatedAt)),
    db
      .select({
        id: inspections.id,
        propertyId: inspections.propertyId,
        inspectionDate: inspections.inspectionDate,
        inspectionTime: inspections.inspectionTime,
        attended: inspections.attended,
        address: properties.address,
        suburb: properties.suburb,
      })
      .from(inspections)
      .leftJoin(properties, eq(inspections.propertyId, properties.id))
      .where(
        and(
          inArray(inspections.userId, hhIds),
          gte(inspections.inspectionDate, now),
        ),
      )
      .orderBy(inspections.inspectionDate)
      .limit(30),
    getAgentsWithPropertyCountsForClerkSafe(clerkId),
    getFollowedSuburbs(),
    db
      .select()
      .from(agentInsights)
      .where(inArray(agentInsights.userId, hhIds))
      .orderBy(desc(agentInsights.createdAt))
      .limit(50),
  ]);

  let convo = convoRows[0];
  if (!convo) {
    const [created] = await db
      .insert(agentConversations)
      .values({ userId: u.id, messages: [] })
      .returning();
    convo = created;
  }

  const insightsByProp = new Map<string, string>();
  for (const ins of insightsRaw) {
    if (ins.propertyId && !insightsByProp.has(ins.propertyId)) {
      insightsByProp.set(ins.propertyId, ins.content);
    }
  }

  const inspectedPropertyIds = new Set(
    inspRaw.filter((i) => i.attended).map((i) => i.propertyId),
  );
  const hasNoteProps = new Set(
    propsRaw.filter((p) => p.notes?.trim()).map((p) => p.id),
  );

  const pipeline = propsRaw.map((p) => ({
    id: p.id,
    address: p.address,
    suburb: p.suburb,
    status: p.status,
    imageUrl: p.imageUrl,
    auctionDate: p.auctionDate,
    auctionTime: p.auctionTime,
    insight: insightsByProp.get(p.id) ?? null,
    hasInspection: inspectedPropertyIds.has(p.id),
    hasNotes: hasNoteProps.has(p.id),
  }));

  const timeline: {
    id: string;
    date: string;
    dayLabel: string;
    time: string;
    title: string;
    type: "inspection" | "auction" | "followup";
    propertyId?: string;
  }[] = [];

  for (const insp of inspRaw) {
    const d = new Date(insp.inspectionDate);
    if (d > in7d) continue;
    timeline.push({
      id: `insp-${insp.id}`,
      date: d.toISOString().slice(0, 10),
      dayLabel: d.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).toUpperCase(),
      time: insp.inspectionTime,
      title: insp.address ?? "Property",
      type: "inspection",
      propertyId: insp.propertyId,
    });
  }

  for (const p of propsRaw) {
    if (!p.auctionDate) continue;
    const ad = new Date(p.auctionDate + "T00:00:00");
    if (ad < now || ad > in7d) continue;
    timeline.push({
      id: `auction-${p.id}`,
      date: p.auctionDate,
      dayLabel: ad
        .toLocaleDateString("en-AU", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
        .toUpperCase(),
      time: p.auctionTime ?? "TBC",
      title: p.address,
      type: "auction",
      propertyId: p.id,
    });
  }

  timeline.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.time < b.time ? -1 : 1;
  });

  const agentCards = agentsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    agencyName: a.agencyName,
    photoUrl: a.photoUrl,
    propertyCount: a.propertyCount,
  }));

  const suburbCards = suburbsRaw.map((s) => ({
    suburb: s.suburb,
    postcode: s.postcode,
  }));

  return {
    conversationId: convo.id,
    urgentActions: checklist.slice(0, 8),
    pipeline,
    timeline,
    agents: agentCards,
    suburbs: suburbCards,
  };
}

export default async function AgentPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  await ensureClerkUserSynced(user);

  const data = await getData(user.id);
  if (!data) redirect("/dashboard");

  return (
    <CommandCentre
      conversationId={data.conversationId}
      urgentActions={data.urgentActions}
      pipeline={data.pipeline}
      timeline={data.timeline}
      agents={data.agents}
      suburbs={data.suburbs}
    />
  );
}
