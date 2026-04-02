import { PropertiesEmptyState } from "@/components/properties/properties-empty-state";
import { PropertiesPageClient } from "@/components/properties/properties-page-client";
import { getPropertiesForClerkUserSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function PropertiesPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const list = await getPropertiesForClerkUserSafe(user?.id);

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

      {list.length === 0 ? (
        <PropertiesEmptyState />
      ) : (
        <PropertiesPageClient properties={list} />
      )}
    </div>
  );
}
