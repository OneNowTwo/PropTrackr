import { desc, eq, inArray } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agent/agent-chat";
import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  agentConversations,
  agentInsights,
  agents,
  inspections,
  properties,
  users,
} from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";
import type { ChatMessage } from "@/lib/agent/types";

export const metadata = { title: "Buyers Aigent | PropTrackr" };

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
        .where(eq(inspections.userId, u.id))
        .orderBy(inspections.inspectionDate)
        .limit(1)
        .then((r) => {
          const row = r.find((i) => i.date >= now);
          if (!row) return null;
          return `${row.date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} ${row.time}`;
        }),
      db
        .select({ auctionDate: properties.auctionDate })
        .from(properties)
        .where(inArray(properties.userId, hhIds))
        .then((rows) => {
          const upcoming = rows
            .filter(
              (r) =>
                r.auctionDate &&
                r.auctionDate >= now.toISOString().slice(0, 10),
            )
            .sort((a, b) => (a.auctionDate! > b.auctionDate! ? 1 : -1));
          return upcoming[0]?.auctionDate ?? null;
        }),
      db
        .select({ id: agentInsights.id })
        .from(agentInsights)
        .where(eq(agentInsights.userId, u.id))
        .then((r) => r.length),
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

async function buildAutoMessage(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<string | null> {
  const ctx = (searchParams.context as string) ?? "";
  if (!ctx) return null;

  const db = getDb();

  if (ctx === "auction" && searchParams.propertyId) {
    const [p] = await db
      .select({ address: properties.address, auctionDate: properties.auctionDate })
      .from(properties)
      .where(eq(properties.id, searchParams.propertyId as string))
      .limit(1);
    if (p) {
      const days = p.auctionDate
        ? Math.ceil(
            (new Date(p.auctionDate).getTime() - Date.now()) / 86_400_000,
          )
        : null;
      return `Give me auction strategy for ${p.address}.${days !== null ? ` Auction is in ${days} days.` : ""} What should I know before bidding?`;
    }
  }

  if (ctx === "post-inspection" && searchParams.propertyId) {
    const [p] = await db
      .select({ address: properties.address })
      .from(properties)
      .where(eq(properties.id, searchParams.propertyId as string))
      .limit(1);
    if (p) {
      return `I just attended the inspection at ${p.address}. What should I be thinking about now? What are the key follow-up steps?`;
    }
  }

  if (ctx === "agent" && searchParams.agentName) {
    const name = searchParams.agentName as string;
    const agency = (searchParams.agency as string) ?? "";
    return `Tell me about ${name}${agency ? ` from ${agency}` : ""}. What should I know when dealing with them?`;
  }

  if (
    ctx === "compare" &&
    searchParams.property1 &&
    searchParams.property2
  ) {
    const rows = await db
      .select({ address: properties.address })
      .from(properties)
      .where(
        inArray(properties.id, [
          searchParams.property1 as string,
          searchParams.property2 as string,
        ]),
      );
    if (rows.length === 2) {
      return `Help me decide between ${rows[0].address} and ${rows[1].address}. Which is the better buy and why?`;
    }
  }

  if (ctx === "suburb" && searchParams.suburb) {
    const suburb = searchParams.suburb as string;
    const postcode = (searchParams.postcode as string) ?? "";
    return `Give me a buyers agent perspective on ${suburb}${postcode ? " " + postcode : ""}. Is it a good time to buy there? What are the risks and opportunities?`;
  }

  if (ctx === "saturday-prep" && searchParams.addresses) {
    const addresses = searchParams.addresses as string;
    const count = (searchParams.count as string) ?? "";
    return `I have ${count || "several"} inspections this Saturday: ${addresses}. Give me a briefing on what to look for at each one and how to prepare.`;
  }

  if (ctx === "new-property" && searchParams.propertyId) {
    const [p] = await db
      .select({ address: properties.address, suburb: properties.suburb })
      .from(properties)
      .where(eq(properties.id, searchParams.propertyId as string))
      .limit(1);
    if (p) {
      return `I just saved a new property: ${p.address}, ${p.suburb}. What should I know about it? Give me a quick initial assessment.`;
    }
  }

  return null;
}

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AgentPage({ searchParams }: PageProps) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  await ensureClerkUserSynced(user);

  const data = await getData(user.id);
  if (!data) redirect("/dashboard");

  const autoMessage = await buildAutoMessage(searchParams);

  return (
    <div className="mx-auto h-[calc(100vh-4rem)] w-full max-w-5xl pb-16 md:pb-0">
      <AgentChat
        conversationId={data.conversationId}
        initialMessages={data.initialMessages}
        autoMessage={autoMessage}
        stats={data.stats}
      />
    </div>
  );
}
