import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  CalendarCheck,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { DiscoverPasteCard } from "@/components/dashboard/discover-paste-card";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDashboardDataSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function firstName(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | undefined {
  if (!user) return undefined;
  if (user.firstName) return user.firstName;
  const full = user.fullName || user.username;
  return full?.split(/\s+/)[0];
}

function todayLine() {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const { userId: clerkUserId } = await auth();
  const idForQueries = clerkUserId ?? user?.id ?? undefined;
  const name = firstName(user);

  const dash = await getDashboardDataSafe(idForQueries);
  const { stats, recent } = dash;
  const n = stats.inspectionsThisWeek;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0D9488]">{todayLine()}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            {name ? `Good to see you again, ${name}` : "Welcome home"}
          </h1>
          <p className="text-[#6B7280]">
            {n === 0
              ? "No inspections scheduled this week — add a property or open the planner when you’re ready."
              : n === 1
                ? "You have 1 inspection coming up this week."
                : `You have ${n} inspections coming up this week.`}
          </p>
        </div>
        <Button
          className="gap-2 bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90"
          asChild
        >
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

      <DiscoverPasteCard />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
            Recent properties
          </h2>
          {recent.length > 0 ? (
            <Link
              href="/properties"
              className="text-sm font-semibold text-[#0D9488] hover:underline"
            >
              View all properties →
            </Link>
          ) : null}
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
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((property) => (
              <li key={property.id}>
                <PropertyCard property={property} variant="featured" />
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
    <Card className="overflow-hidden border-[#E5E7EB] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              {title}
            </p>
            <p
              className={cn(
                "text-3xl font-bold tabular-nums tracking-tight text-[#0D9488]",
                "sm:text-4xl",
              )}
            >
              {value}
            </p>
          </div>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]"
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
