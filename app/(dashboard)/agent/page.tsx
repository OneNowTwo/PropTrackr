import { desc, eq, gte, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agent/agent-chat";
import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  agentConversations,
  agentInsights,
  inspections,
  properties,
  users,
} from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";
import type { ChatMessage } from "@/lib/agent/types";

export const metadata = { title: "AI Agent — PropTrackr" };

async function getData(clerkId: string) {
  const db = getDb();
  const [u] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return null;

  const hhIds = await getHouseholdUserIds(u.id);
  const now = new Date();

  const [convoRows, propCount, nextInsp, nextAuction, unreadInsights] =
    await Promise.all([
      db
        .select()
        .from(agentConversations)
        .where(eq(agentConversations.userId, u.id))
        .orderBy(desc(agentConversations.updatedAt))
        .limit(1),
      db
        .select({ id: properties.id })
        .from(properties)
        .where(inArray(properties.userId, hhIds))
        .then((r) => r.length),
      db
        .select({
          date: inspections.inspectionDate,
          time: inspections.inspectionTime,
        })
        .from(inspections)
        .where(
          eq(inspections.userId, u.id),
        )
        .orderBy(inspections.inspectionDate)
        .limit(1)
        .then((r) => {
          const row = r.find(
            (i) => i.date >= now,
          );
          if (!row) return null;
          return `${row.date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} ${row.time}`;
        }),
      db
        .select({ auctionDate: properties.auctionDate })
        .from(properties)
        .where(inArray(properties.userId, hhIds))
        .then((rows) => {
          const upcoming = rows
            .filter((r) => r.auctionDate && r.auctionDate >= now.toISOString().slice(0, 10))
            .sort((a, b) => (a.auctionDate! > b.auctionDate! ? 1 : -1));
          return upcoming[0]?.auctionDate ?? null;
        }),
      db
        .select({ id: agentInsights.id })
        .from(agentInsights)
        .where(
          eq(agentInsights.userId, u.id),
        )
        .then((r) => r.filter((x) => true).length),
    ]);

  let convo = convoRows[0];
  if (!convo) {
    const [created] = await db
      .insert(agentConversations)
      .values({ userId: u.id, messages: [] })
      .returning();
    convo = created;
  }

  return {
    conversationId: convo.id,
    initialMessages: (convo.messages ?? []) as ChatMessage[],
    stats: {
      propertyCount: propCount,
      nextInspection: nextInsp,
      nextAuction: nextAuction,
      unreadInsights: unreadInsights,
    },
  };
}

export default async function AgentPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  await ensureClerkUserSynced(user);

  const data = await getData(user.id);
  if (!data) redirect("/dashboard");

  return (
    <div className="mx-auto h-[calc(100vh-4rem)] w-full max-w-5xl pb-16 md:pb-0">
      <AgentChat
        conversationId={data.conversationId}
        initialMessages={data.initialMessages}
        stats={data.stats}
      />
    </div>
  );
}
