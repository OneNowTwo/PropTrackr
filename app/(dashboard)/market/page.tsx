import { asc, desc, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import {
  MarketIntelligenceClient,
  type MarketSaleResultRow,
} from "@/components/market/market-intelligence-client";
import { getDb } from "@/lib/db";
import { fetchSaleResultsForUser } from "@/lib/db/sale-results-queries";
import { agents, properties, users } from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";

export default async function MarketPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);

  let serialized: unknown[] = [];
  let agentOpts: { id: string; name: string }[] = [];
  let propOpts: {
    id: string;
    label: string;
    address: string;
    suburb: string;
    postcode: string;
    bedrooms: number | null;
    propertyType: string | null;
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
        const [rows, agentRows, propRows] = await Promise.all([
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
            })
            .from(properties)
            .where(eq(properties.userId, ur.id))
            .orderBy(desc(properties.updatedAt)),
        ]);
        serialized = JSON.parse(JSON.stringify(rows));
        agentOpts = agentRows;
        propOpts = propRows.map((p) => ({
          id: p.id,
          label: `${p.address}, ${p.suburb}`,
          address: p.address,
          suburb: p.suburb,
          postcode: p.postcode,
          bedrooms: p.bedrooms,
          propertyType: p.propertyType,
        }));
      }
    } catch {
      /* DB unavailable */
    }
  }

  return (
    <MarketIntelligenceClient
      initialResults={serialized as MarketSaleResultRow[]}
      agents={agentOpts}
      propertyOptions={propOpts}
    />
  );
}
