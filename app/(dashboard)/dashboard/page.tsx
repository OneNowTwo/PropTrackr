import { currentUser } from "@clerk/nextjs/server";
import { Building2, CalendarCheck, ListChecks, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDashboardDataSafe } from "@/lib/db/queries";
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
  const { stats, recent } = await getDashboardDataSafe(user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s a snapshot of your search. Add properties to start
            building your shortlist.
          </p>
        </div>
        <Button className="gap-2 shadow-md shadow-primary/15" asChild>
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

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Recent properties
          </h2>
        </div>
        <Separator className="bg-border" />
        {recent.length === 0 ? (
          <Card className="border-dashed border-line bg-white shadow-card">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                No properties yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                When you save a listing, it will appear here with price,
                location, and status at a glance.
              </p>
              <Button className="gap-2" asChild>
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
    <Card className="border-line bg-white shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
