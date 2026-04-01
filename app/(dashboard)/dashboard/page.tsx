import { currentUser } from "@clerk/nextjs/server";
import { Building2, CalendarCheck, ListChecks, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { DiscoveryFeed } from "@/components/dashboard/discovery-feed";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getDashboardDataSafe,
  getDiscoveredPropertiesForUserSafe,
  getSearchPreferencesForUserSafe,
} from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

function firstName(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | undefined {
  if (!user) return undefined;
  if (user.firstName) return user.firstName;
  const full = user.fullName || user.username;
  return full?.split(/\s+/)[0];
}

export default async function DashboardPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const name = firstName(user);
  const [dash, prefs, pendingDisc, maybeDisc] = await Promise.all([
    getDashboardDataSafe(user?.id),
    getSearchPreferencesForUserSafe(user?.id),
    getDiscoveredPropertiesForUserSafe(user?.id, ["pending"]),
    getDiscoveredPropertiesForUserSafe(user?.id, ["maybe"]),
  ]);
  const { stats, recent } = dash;
  const hasSearchPreferences = Boolean(
    prefs && prefs.suburbs && prefs.suburbs.length > 0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-[#6B7280]">
            Here&apos;s a snapshot of your search. Add properties to start
            building your shortlist.
          </p>
        </div>
        <Button className="gap-2 bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90" asChild>
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            Add property
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total properties"
          value={stats.totalProperties}
          icon={Building2}
        />
        <StatCard
          title="Upcoming inspections"
          value={stats.upcomingInspections}
          icon={CalendarCheck}
        />
        <StatCard
          title="Shortlisted"
          value={stats.shortlisted}
          icon={Sparkles}
        />
        <StatCard
          title="Inspections attended"
          value={stats.inspectionsAttended}
          icon={ListChecks}
        />
      </div>

      <DiscoveryFeed
        hasPreferences={hasSearchPreferences}
        pending={pendingDisc}
        maybe={maybeDisc}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
            Recent properties
          </h2>
        </div>
        <Separator className="bg-[#E5E7EB]" />
        {recent.length === 0 ? (
          <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-medium text-[#111827]">
                No properties yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[#6B7280]">
              <p>
                When you save a listing, it will appear here with price,
                location, and status at a glance.
              </p>
              <Button
                className="gap-2 bg-[#0D9488] font-medium text-white hover:bg-[#0D9488]/90"
                asChild
              >
                <Link href="/properties/new">
                  <Plus className="h-4 w-4" />
                  Add property
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {recent.map((property) => (
              <li key={property.id}>
                <PropertyCard property={property} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#6B7280]">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-[#0D9488]" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-[#111827]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
