import { GitCompareArrows } from "lucide-react";
import Link from "next/link";

import { ComparePropertiesClient } from "@/components/compare/compare-properties-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPropertiesForClerkUserSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function ComparePage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const properties = await getPropertiesForClerkUserSafe(user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#111827]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <GitCompareArrows className="h-5 w-5" />
          </span>
          Compare
        </h1>
        <p className="mt-2 max-w-2xl text-[#6B7280]">
          Pick two of your properties, review specs side by side, and generate an
          AI verdict on value, lifestyle fit, and trade-offs.
        </p>
      </div>

      {properties.length < 2 ? (
        <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#111827]">
              Compare properties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#6B7280]">
            <p>Add at least 2 properties to compare them.</p>
            <Button
              className="bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
              asChild
            >
              <Link href="/properties/new">Add property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ComparePropertiesClient properties={properties} />
      )}
    </div>
  );
}
