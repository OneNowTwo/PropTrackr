import { asc, desc, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import {
  MarketIntelligenceClient,
  type MarketSaleResultRow,
} from "@/components/market/market-intelligence-client";
import { getFollowedSuburbsForDbUser } from "@/app/actions/suburbs";
import { getDb } from "@/lib/db";
import { fetchSaleResultsForUser } from "@/lib/db/sale-results-queries";
import { agents, properties, users } from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function MarketPage({ searchParams }: PageProps) {
  const logRaw = searchParams.logUrl;
  const initialLogUrl =
    typeof logRaw === "string"
      ? logRaw
      : Array.isArray(logRaw)
        ? logRaw[0]
        : undefined;
  const user = await currentUser();
  await ensureClerkUserSynced(user);

  let serialized: unknown[] = [];
  let trackedSuburbs: { suburb: string; postcode: string }[] = [];
  let agentOpts: { id: string; name: string }[] = [];
  let propOpts: {
    id: string;
    label: string;
    address: string;
    suburb: string;
    postcode: string;
    bedrooms: number | null;
    propertyType: string | null;
    auctionDate: string | null;
  }[] = [];

  if (user?.id && process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const [ur] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, user.id))
        .limit(1);
      if (ur) {
        const [rows, agentRows, propRows, followedSuburbs] = await Promise.all([
          fetchSaleResultsForUser(ur.id),
          db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(eq(agents.userId, ur.id))
            .orderBy(asc(agents.name)),
          db
            .select({
              id: properties.id,
              title: properties.title,
              address: properties.address,
              suburb: properties.suburb,
              postcode: properties.postcode,
              bedrooms: properties.bedrooms,
              propertyType: properties.propertyType,
              auctionDate: properties.auctionDate,
            })
            .from(properties)
            .where(eq(properties.userId, ur.id))
            .orderBy(desc(properties.updatedAt)),
          getFollowedSuburbsForDbUser(ur.id),
        ]);
        serialized = JSON.parse(JSON.stringify(rows));
        const fromProps = propRows.map((p) => ({
          suburb: p.suburb?.trim() ?? "",
          postcode: p.postcode?.trim() ?? "",
        }));
        const fromFollowed = followedSuburbs.map((s) => ({
          suburb: s.suburb.trim(),
          postcode: s.postcode.trim(),
        }));
        const seen = new Set<string>();
        trackedSuburbs = [];
        for (const t of [...fromFollowed, ...fromProps]) {
          if (!t.suburb || !t.postcode) continue;
          const k = `${t.suburb}\0${t.postcode}`;
          if (seen.has(k)) continue;
          seen.add(k);
          trackedSuburbs.push(t);
        }
        agentOpts = agentRows;
        propOpts = propRows.map((p) => ({
          id: p.id,
          label: `${p.address}, ${p.suburb}`,
          address: p.address,
          suburb: p.suburb,
          postcode: p.postcode,
          bedrooms: p.bedrooms,
          propertyType: p.propertyType,
          auctionDate: p.auctionDate,
        }));
      }
    } catch {
      /* DB unavailable */
    }
  }

  return (
    <MarketIntelligenceClient
      initialResults={serialized as MarketSaleResultRow[]}
      trackedSuburbs={trackedSuburbs}
      agents={agentOpts}
      propertyOptions={propOpts}
      initialLogUrl={initialLogUrl}
    />
  );
}
