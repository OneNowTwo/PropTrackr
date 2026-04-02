import Link from "next/link";
import { Plus } from "lucide-react";

import { PropertiesEmptyState } from "@/components/properties/properties-empty-state";
import { PropertiesPageClient } from "@/components/properties/properties-page-client";
import { Button } from "@/components/ui/button";
import { getPropertiesForClerkUserSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function PropertiesPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const list = await getPropertiesForClerkUserSafe(user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Properties
          </h1>
          <p className="mt-1 text-[#6B7280]">
            All saved listings in one place — filter, sort, and switch layout.
          </p>
        </div>
        <Button
          className="hidden gap-2 bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90 sm:inline-flex"
          asChild
        >
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            Add property
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <PropertiesEmptyState />
      ) : (
        <PropertiesPageClient properties={list} />
      )}
    </div>
  );
}
