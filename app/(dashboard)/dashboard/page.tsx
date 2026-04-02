import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  GitCompareArrows,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { RecentEmailsWidget } from "@/components/dashboard/recent-emails-widget";
import { Card, CardContent } from "@/components/ui/card";
import { getRecentPropertyEmailsForDashboardSafe } from "@/lib/db/gmail-queries";
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

function formatInspectionWhen(d: Date) {
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const { userId: clerkUserId } = await auth();
  const idForQueries = clerkUserId ?? user?.id ?? undefined;
  const name = firstName(user);

  const [dash, recentEmails] = await Promise.all([
    getDashboardDataSafe(idForQueries),
    getRecentPropertyEmailsForDashboardSafe(idForQueries, 5),
  ]);
  const { stats, recent, overview } = dash;
  const previewImages = recent
    .map((p) => p.imageUrl?.trim())
    .filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-1">
        <p className="text-sm text-[#6B7280]">{todayLine()}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          {name ? `Hi, ${name}` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#6B7280]">
          Overview of your search — open a section below to go deeper.
        </p>
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
          title="Attended"
          value={stats.inspectionsAttended}
          icon={ListChecks}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/properties" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2">
          <Card className="h-full border-[#E5E7EB] bg-white shadow-sm transition-shadow group-hover:shadow-md">
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Properties
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D9488]">
                    {stats.totalProperties}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    saved {stats.totalProperties === 1 ? "property" : "properties"}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <Building2 className="h-5 w-5" />
                </span>
              </div>
              {previewImages.length > 0 ? (
                <div className="mt-4 flex gap-2">
                  {previewImages.slice(0, 2).map((url) => (
                    <div
                      key={url}
                      className="relative h-14 w-20 overflow-hidden rounded-lg bg-[#F3F4F6] ring-1 ring-[#E5E7EB]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 h-14 rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFA]" />
              )}
              <span className="mt-4 text-sm font-semibold text-[#0D9488] group-hover:underline">
                View all →
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/planner" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2">
          <Card className="h-full border-[#E5E7EB] bg-white shadow-sm transition-shadow group-hover:shadow-md">
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Inspections
                  </p>
                  <p className="mt-3 text-sm font-medium text-[#111827]">
                    This Saturday:{" "}
                    <span className="font-bold text-[#0D9488] tabular-nums">
                      {overview.saturdayOpenHomes}
                    </span>{" "}
                    {overview.saturdayOpenHomes === 1 ? "open home" : "open homes"}
                  </p>
                  {overview.nextInspection ? (
                    <p className="mt-2 truncate text-sm text-[#6B7280]">
                      Next:{" "}
                      <span className="font-medium text-[#374151]">
                        {formatInspectionWhen(overview.nextInspection.at)}
                      </span>
                      <span className="mx-1">·</span>
                      <span className="font-medium text-[#374151]">
                        {overview.nextInspection.propertyLabel}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[#6B7280]">
                      No upcoming inspections scheduled.
                    </p>
                  )}
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <CalendarDays className="h-5 w-5" />
                </span>
              </div>
              <span className="mt-auto pt-4 text-sm font-semibold text-[#0D9488] group-hover:underline">
                View planner →
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agents" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2">
          <Card className="h-full border-[#E5E7EB] bg-white shadow-sm transition-shadow group-hover:shadow-md">
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Agents
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D9488]">
                    {overview.agentsTracked}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    {overview.agentsTracked === 1 ? "agent" : "agents"} tracked
                  </p>
                  <p className="mt-3 text-sm text-[#374151]">
                    <span className="font-semibold tabular-nums text-[#111827]">
                      {overview.pendingChecklistItems}
                    </span>{" "}
                    pending checklist{" "}
                    {overview.pendingChecklistItems === 1 ? "item" : "items"}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <Users className="h-5 w-5" />
                </span>
              </div>
              <span className="mt-4 text-sm font-semibold text-[#0D9488] group-hover:underline">
                View agents →
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/compare" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2">
          <Card className="h-full border-[#E5E7EB] bg-white shadow-sm transition-shadow group-hover:shadow-md">
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Compare
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                    Compare your shortlisted properties side by side.
                  </p>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-[#0D9488]">
                    {stats.shortlisted}
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    shortlisted
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                  <GitCompareArrows className="h-5 w-5" />
                </span>
              </div>
              <span className="mt-4 text-sm font-semibold text-[#0D9488] group-hover:underline">
                Compare now →
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <RecentEmailsWidget emails={recentEmails} />
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
