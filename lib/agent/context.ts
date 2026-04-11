import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  agentNotes,
  agents,
  followedSuburbs,
  inspections,
  properties,
  propertyEmails,
  propertyNotes,
  users,
  voiceNotes,
} from "@/lib/db/schema";

import type {
  AgentContext,
  AgentPerformanceBrief,
  AgentProperty,
  AgentEmail,
  AgentInspection,
} from "./types";

export async function buildAgentContext(
  clerkUserId: string,
): Promise<AgentContext> {
  const db = getDb();

  const [userRow] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!userRow)
    return {
      userName: undefined,
      properties: [],
      upcomingInspections: [],
      recentEmails: [],
      suburbs: [],
      voiceNoteSummaries: [],
      agentPerformance: [],
    };

  const hhIds = await getHouseholdUserIds(userRow.id);
  const fourteenDaysAhead = new Date();
  fourteenDaysAhead.setDate(fourteenDaysAhead.getDate() + 14);
  const now = new Date();

  const [
    propsRaw,
    inspRaw,
    emailsRaw,
    suburbsRaw,
    vnRaw,
  ] = await Promise.all([
    db
      .select()
      .from(properties)
      .where(inArray(properties.userId, hhIds))
      .orderBy(desc(properties.updatedAt)),
    db
      .select({
        propertyId: inspections.propertyId,
        inspectionDate: inspections.inspectionDate,
        inspectionTime: inspections.inspectionTime,
        attended: inspections.attended,
        propertyAddress: properties.address,
        propertySuburb: properties.suburb,
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
      .limit(20),
    db
      .select({
        fromName: propertyEmails.fromName,
        subject: propertyEmails.subject,
        receivedAt: propertyEmails.receivedAt,
        propertyAddress: properties.address,
      })
      .from(propertyEmails)
      .leftJoin(properties, eq(propertyEmails.propertyId, properties.id))
      .where(
        and(
          inArray(propertyEmails.userId, hhIds),
          isNotNull(propertyEmails.propertyId),
        ),
      )
      .orderBy(desc(propertyEmails.receivedAt))
      .limit(20),
    db
      .select({ suburb: followedSuburbs.suburb })
      .from(followedSuburbs)
      .where(inArray(followedSuburbs.userId, hhIds)),
    db
      .select({ transcript: voiceNotes.transcript })
      .from(voiceNotes)
      .where(
        and(
          inArray(voiceNotes.userId, hhIds),
          isNotNull(voiceNotes.transcript),
        ),
      )
      .orderBy(desc(voiceNotes.createdAt))
      .limit(5),
  ]);

  const agentProps: AgentProperty[] = propsRaw.map((p) => ({
    id: p.id,
    address: p.address,
    suburb: p.suburb,
    state: p.state,
    postcode: p.postcode,
    price: p.price,
    status: p.status,
    propertyType: p.propertyType,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    auctionDate: p.auctionDate,
    auctionTime: p.auctionTime,
    notesSummary: p.notes?.slice(0, 200) ?? null,
    listingUrl: p.listingUrl,
  }));

  const agentInsp: AgentInspection[] = inspRaw.map((i) => ({
    propertyId: i.propertyId ?? null,
    address: i.propertyAddress ?? "Unknown",
    suburb: i.propertySuburb ?? "",
    date: i.inspectionDate.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    startTime: i.inspectionTime,
    attended: i.attended,
  }));

  const agentEmails: AgentEmail[] = emailsRaw.map((e) => ({
    from: e.fromName ?? "Unknown",
    subject: e.subject ?? "(no subject)",
    date: e.receivedAt
      ? new Date(e.receivedAt).toLocaleDateString("en-AU")
      : "",
    propertyAddress: e.propertyAddress ?? null,
  }));

  const agentIdSet = new Set<string>();
  for (const p of propsRaw) {
    if (p.agentId) agentIdSet.add(p.agentId);
  }
  const linkedAgentIds = Array.from(agentIdSet);

  let agentPerformance: AgentPerformanceBrief[] = [];
  if (linkedAgentIds.length > 0) {
    const [agentMeta, noteRows] = await Promise.all([
      db
        .select({
          id: agents.id,
          name: agents.name,
          agencyName: agents.agencyName,
        })
        .from(agents)
        .where(
          and(inArray(agents.id, linkedAgentIds), inArray(agents.userId, hhIds)),
        ),
      db
        .select({
          agentId: agentNotes.agentId,
          note: agentNotes.note,
          rating: agentNotes.rating,
          category: agentNotes.category,
          createdAt: agentNotes.createdAt,
        })
        .from(agentNotes)
        .where(
          and(
            inArray(agentNotes.agentId, linkedAgentIds),
            inArray(agentNotes.userId, hhIds),
          ),
        )
        .orderBy(desc(agentNotes.createdAt)),
    ]);

    const notesByAgent = new Map<string, typeof noteRows>();
    for (const row of noteRows) {
      const list = notesByAgent.get(row.agentId) ?? [];
      list.push(row);
      notesByAgent.set(row.agentId, list);
    }

    agentPerformance = agentMeta.map((a) => {
      const list = notesByAgent.get(a.id) ?? [];
      const rated = list.filter(
        (n) => n.rating != null && n.rating >= 1 && n.rating <= 5,
      );
      const averageRating =
        rated.length === 0
          ? null
          : Math.round(
              (rated.reduce((s, n) => s + (n.rating as number), 0) /
                rated.length) *
                10,
            ) / 10;
      const recentNotes = list.slice(0, 5).map((n) => ({
        note: n.note.slice(0, 400),
        rating: n.rating,
        category: n.category,
      }));
      return {
        agentId: a.id,
        name: a.name,
        agencyName: a.agencyName,
        averageRating,
        noteCount: list.length,
        recentNotes,
      };
    });
  }

  const suburbNamesFromFollowed = suburbsRaw.map((s) => s.suburb.trim());
  const suburbNamesFromProps = propsRaw
    .map((p) => p.suburb?.trim())
    .filter(Boolean) as string[];
  const suburbsWatchList = Array.from(
    new Set([...suburbNamesFromFollowed, ...suburbNamesFromProps]),
  );

  return {
    userName: userRow.name?.split(" ")[0],
    properties: agentProps,
    upcomingInspections: agentInsp,
    recentEmails: agentEmails,
    suburbs: suburbsWatchList,
    voiceNoteSummaries: vnRaw
      .map((v) => v.transcript)
      .filter(Boolean) as string[],
    agentPerformance,
  };
}
