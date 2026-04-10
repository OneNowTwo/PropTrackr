import { eq, inArray } from "drizzle-orm";

import { PropertiesEmptyState } from "@/components/properties/properties-empty-state";
import { PropertiesPageClient } from "@/components/properties/properties-page-client";
import { getDb } from "@/lib/db";
import { getHouseholdUserIdsByClerk } from "@/lib/db/household";
import { getPropertiesForClerkUserSafe } from "@/lib/db/queries";
import { users } from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function PropertiesPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const list = await getPropertiesForClerkUserSafe(user?.id);

  let ownDbUserId = "";
  const nameMap: Record<string, string> = {};
  if (user?.id && process.env.DATABASE_URL) {
    try {
      const hhIds = await getHouseholdUserIdsByClerk(user.id);
      if (hhIds.length > 0) {
        const db = getDb();
        const rows = await db
          .select({ id: users.id, name: users.name, clerkId: users.clerkId })
          .from(users)
          .where(inArray(users.id, hhIds));
        for (const r of rows) {
          if (r.clerkId === user.id) ownDbUserId = r.id;
          if (r.name) nameMap[r.id] = r.name.split(/\s+/)[0] ?? r.name;
        }
      }
    } catch {}
  }

  const propsWithOwner = list.map((p) => ({
    ...p,
    addedByName: p.userId !== ownDbUserId && nameMap[p.userId]
      ? nameMap[p.userId]
      : undefined,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Properties
        </h1>
        <p className="mt-1 text-[#6B7280]">
          Your saved listings — switch between grid and list. Add new ones from
          the header.
        </p>
      </div>

      {propsWithOwner.length === 0 ? (
        <PropertiesEmptyState />
      ) : (
        <PropertiesPageClient properties={propsWithOwner} />
      )}
    </div>
  );
}
