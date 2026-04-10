import { and, count, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CommandCentre } from "@/components/agent/command-centre";
import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import { getAgentsWithPropertyCountsForClerkSafe } from "@/lib/db/agent-queries";
import { getFollowedSuburbs } from "@/app/actions/suburbs";
import {
  generateUrgentActions,
  generatePropertyOneLiners,
  generateAgentOneLiners,
  generateSuburbOneLiners,
  generateDailyBriefing,
} from "@/app/actions/agent";
import {
  agentConversations,
  agentInsights,
  documents,
  inspections,
  properties,
  propertyEmails,
  users,
  voiceNotes,
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
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    convoRows,
    propsRaw,
    allInspections,
    agentsRaw,
    suburbsRaw,
    docCounts,
    vnCounts,
  ] = await Promise.all([
    db
      .select()
      .from(agentConversations)
      .where(eq(agentConversations.userId, u.id))
      .orderBy(desc(agentConversations.updatedAt))
      .limit(1),
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
      .where(inArray(inspections.userId, hhIds))
      .orderBy(inspections.inspectionDate)
      .limit(200),
    getAgentsWithPropertyCountsForClerkSafe(clerkId),
    getFollowedSuburbs(),
    db
      .select({ propertyId: documents.propertyId, c: count() })
      .from(documents)
      .where(inArray(documents.userId, hhIds))
      .groupBy(documents.propertyId),
    db
      .select({ propertyId: voiceNotes.propertyId, c: count() })
      .from(voiceNotes)
      .where(inArray(voiceNotes.userId, hhIds))
      .groupBy(voiceNotes.propertyId),
  ]);

  let convo = convoRows[0];
  if (!convo) {
    const [created] = await db
      .insert(agentConversations)
      .values({ userId: u.id, messages: [] })
      .returning();
    convo = created;
  }

  const docsByProp = new Map<string, number>();
  for (const d of docCounts) {
    if (d.propertyId) docsByProp.set(d.propertyId, Number(d.c));
  }
  const vnByProp = new Map<string, number>();
  for (const v of vnCounts) {
    if (v.propertyId) vnByProp.set(v.propertyId, Number(v.c));
  }

  const inspectedPropertyIds = new Set(
    allInspections.filter((i) => i.attended).map((i) => i.propertyId),
  );
  const scheduledPropertyIds = new Set(
    allInspections
      .filter((i) => !i.attended && new Date(i.inspectionDate) >= now)
      .map((i) => i.propertyId),
  );
  const hasNoteProps = new Set(
    propsRaw.filter((p) => p.notes?.trim()).map((p) => p.id),
  );

  // Stage detection
  function computeStage(p: typeof propsRaw[0]): number {
    if (p.status === "purchased") return 5;
    if (p.auctionDate) {
      const ad = new Date(p.auctionDate + "T00:00:00");
      if (ad >= now && ad <= in30d) return 4;
    }
    const hasDocs = (docsByProp.get(p.id) ?? 0) > 0;
    const hasVN = (vnByProp.get(p.id) ?? 0) > 0;
    if (p.status === "shortlisted" && (hasDocs || hasVN)) return 3;
    if (p.status === "shortlisted") return 2;
    if (inspectedPropertyIds.has(p.id)) return 1;
    return 0;
  }

  const pipeline = propsRaw.map((p) => ({
    id: p.id,
    address: p.address,
    suburb: p.suburb,
    status: p.status,
    imageUrl: p.imageUrl,
    auctionDate: p.auctionDate,
    auctionTime: p.auctionTime,
    insight: null as string | null,
    stage: computeStage(p),
    hasInspectionAttended: inspectedPropertyIds.has(p.id),
    hasInspectionScheduled: scheduledPropertyIds.has(p.id),
    hasNotes: hasNoteProps.has(p.id),
    hasDocs: (docsByProp.get(p.id) ?? 0) > 0,
    hasVoiceNotes: (vnByProp.get(p.id) ?? 0) > 0,
  }));

  // Timeline: future inspections within 7 days + auctions
  const futureInspections = allInspections.filter(
    (i) => new Date(i.inspectionDate) >= now && new Date(i.inspectionDate) <= in7d,
  );

  const timeline: {
    id: string;
    date: string;
    dayLabel: string;
    time: string;
    title: string;
    type: "inspection" | "auction" | "followup";
    propertyId?: string;
  }[] = [];

  for (const insp of futureInspections) {
    const d = new Date(insp.inspectionDate);
    timeline.push({
      id: `insp-${insp.id}`,
      date: d.toISOString().slice(0, 10),
      dayLabel: d
        .toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
        .toUpperCase(),
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
        .toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
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

  // Agent last interaction: most recent email or inspection date per agent
  const agentPropertyMap = new Map<string, string[]>();
  for (const p of propsRaw) {
    if (p.agentId) {
      const list = agentPropertyMap.get(p.agentId) ?? [];
      list.push(p.id);
      agentPropertyMap.set(p.agentId, list);
    }
  }

  const agentCards = agentsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    agencyName: a.agencyName,
    photoUrl: a.photoUrl,
    propertyCount: a.propertyCount,
    insight: null as string | null,
  }));

  const suburbCards = suburbsRaw.map((s) => ({
    suburb: s.suburb,
    postcode: s.postcode,
    insight: null as string | null,
  }));

  // Fire AI generation calls in parallel (non-blocking for cached results)
  const [urgentActions, propOneLiners, agentOneLiners, suburbOneLiners, briefingResult] =
    await Promise.all([
      generateUrgentActions(),
      generatePropertyOneLiners(
        pipeline.map((p) => ({
          id: p.id,
          address: p.address,
          suburb: p.suburb,
          status: p.status,
          auctionDate: p.auctionDate,
        })),
      ),
      generateAgentOneLiners(
        agentCards.map((a) => ({
          id: a.id,
          name: a.name,
          agencyName: a.agencyName,
          propertyCount: a.propertyCount,
        })),
      ),
      generateSuburbOneLiners(suburbCards.map((s) => ({ suburb: s.suburb, postcode: s.postcode }))),
      generateDailyBriefing(),
    ]);

  for (const p of pipeline) {
    p.insight = propOneLiners[p.id] ?? null;
  }
  for (const a of agentCards) {
    a.insight = agentOneLiners[a.id] ?? null;
  }
  for (const s of suburbCards) {
    s.insight = suburbOneLiners[`${s.suburb}-${s.postcode}`] ?? null;
  }

  return {
    conversationId: convo.id,
    urgentActions,
    pipeline,
    timeline,
    agents: agentCards,
    suburbs: suburbCards,
    briefing: briefingResult?.briefing ?? null,
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
      briefing={data.briefing}
    />
  );
}
