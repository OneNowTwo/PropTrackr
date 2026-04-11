import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import type { MarketSaleResultRow } from "@/components/market/market-intelligence-client";
import { SuburbDetailClient } from "@/components/suburbs/suburb-detail-client";
import { getDb } from "@/lib/db";
import { fetchSaleResultsForSuburb } from "@/lib/db/sale-results-queries";
import { followedSuburbs, properties, users } from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { auth, currentUser } from "@clerk/nextjs/server";

type Props = { params: { suburbSlug: string } };

function parseSlug(slug: string): { suburb: string; postcode: string } | null {
  const m = slug.match(/^(.+)-(\d{4})$/);
  if (!m) return null;
  const suburb = m[1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { suburb, postcode: m[2] };
}

export default async function SuburbDetailPage({ params }: Props) {
  const parsed = parseSlug(params.suburbSlug);
  if (!parsed) notFound();

  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const { userId: clerkId } = await auth();

  let followedId: string | null = null;
  let suburbProps: (typeof properties.$inferSelect)[] = [];
  let loggedSales: MarketSaleResultRow[] = [];

  if (clerkId && process.env.DATABASE_URL) {
    const db = getDb();
    const [ur] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (ur) {
      const [followed] = await db
        .select({ id: followedSuburbs.id, state: followedSuburbs.state })
        .from(followedSuburbs)
        .where(
          and(
            eq(followedSuburbs.userId, ur.id),
            eq(followedSuburbs.suburb, parsed.suburb),
            eq(followedSuburbs.postcode, parsed.postcode),
          ),
        )
        .limit(1);

      followedId = followed?.id ?? null;

      const [propsRows, saleRows] = await Promise.all([
        db
          .select()
          .from(properties)
          .where(
            and(
              eq(properties.userId, ur.id),
              eq(properties.suburb, parsed.suburb),
              eq(properties.postcode, parsed.postcode),
            ),
          ),
        fetchSaleResultsForSuburb(ur.id, parsed.suburb, parsed.postcode),
      ]);
      suburbProps = propsRows;
      loggedSales = JSON.parse(JSON.stringify(saleRows)) as MarketSaleResultRow[];
    }
  }

  const state = suburbProps[0]?.state || "NSW";

  return (
    <SuburbDetailClient
      suburb={parsed.suburb}
      state={state}
      postcode={parsed.postcode}
      followedId={followedId}
      properties={JSON.parse(JSON.stringify(suburbProps))}
      loggedSaleResults={loggedSales}
    />
  );
}
