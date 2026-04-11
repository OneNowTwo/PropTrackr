import { desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getAgentsWithPropertyCountsForClerkSafe } from "@/lib/db/agent-queries";
import { getHouseholdUserIds } from "@/lib/db/household";
import { followedSuburbs, properties, users } from "@/lib/db/schema";

export type CommandCentrePropertyOneLinerInput = {
  id: string;
  address: string;
  suburb: string;
  status: string;
  auctionDate: string | null;
};

export type CommandCentreAgentOneLinerInput = {
  id: string;
  name: string;
  agencyName: string | null;
  propertyCount: number;
};

export type CommandCentreSuburbOneLinerInput = {
  suburb: string;
  postcode: string;
};

/** Loads the same property/agent/suburb sets the command centre uses for AI one-liners (household + merged suburbs). */
export async function loadCommandCentreOneLinerInputs(clerkUserId: string): Promise<{
  properties: CommandCentrePropertyOneLinerInput[];
  agents: CommandCentreAgentOneLinerInput[];
  suburbs: CommandCentreSuburbOneLinerInput[];
}> {
  if (!clerkUserId || !process.env.DATABASE_URL) {
    return { properties: [], agents: [], suburbs: [] };
  }

  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!u) return { properties: [], agents: [], suburbs: [] };

  const hhIds = await getHouseholdUserIds(u.id);

  const [propsRaw, agentsRaw, suburbsFollowedRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        address: properties.address,
        suburb: properties.suburb,
        status: properties.status,
        auctionDate: properties.auctionDate,
        postcode: properties.postcode,
      })
      .from(properties)
      .where(inArray(properties.userId, hhIds))
      .orderBy(desc(properties.updatedAt)),
    getAgentsWithPropertyCountsForClerkSafe(clerkUserId),
    db
      .select({
        suburb: followedSuburbs.suburb,
        postcode: followedSuburbs.postcode,
      })
      .from(followedSuburbs)
      .where(eq(followedSuburbs.userId, u.id))
      .orderBy(followedSuburbs.suburb),
  ]);

  const agentList: CommandCentreAgentOneLinerInput[] = agentsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    agencyName: a.agencyName,
    propertyCount: a.propertyCount,
  }));

  const suburbCardsByKey = new Map<string, CommandCentreSuburbOneLinerInput>();
  for (const s of suburbsFollowedRows) {
    const k = `${s.suburb.trim()}\0${s.postcode.trim()}`;
    suburbCardsByKey.set(k, { suburb: s.suburb, postcode: s.postcode });
  }
  for (const p of propsRaw) {
    const sub = p.suburb?.trim();
    const pc = p.postcode?.trim();
    if (!sub || !pc) continue;
    const k = `${sub}\0${pc}`;
    if (!suburbCardsByKey.has(k)) {
      suburbCardsByKey.set(k, { suburb: sub, postcode: pc });
    }
  }
  const suburbList = Array.from(suburbCardsByKey.values()).sort((a, b) =>
    `${a.suburb} ${a.postcode}`.localeCompare(`${b.suburb} ${b.postcode}`),
  );

  return {
    properties: propsRaw.map((p) => ({
      id: p.id,
      address: p.address,
      suburb: p.suburb,
      status: p.status,
      auctionDate: p.auctionDate,
    })),
    agents: agentList,
    suburbs: suburbList,
  };
}
