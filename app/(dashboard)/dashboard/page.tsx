import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  GitCompareArrows,
  Mail,
  Users,
} from "lucide-react";
import Link from "next/link";

import { getRecentActivity } from "@/app/actions/activity";
import { getChecklistItems } from "@/app/actions/checklist";
import {
  ActivityFeed,
  AnimatedStatCard,
  BuyingJourney,
  ChecklistSection,
  NextInspectionHero,
} from "@/components/dashboard/dashboard-client";
import { RecentEmailsWidget } from "@/components/dashboard/recent-emails-widget";
import { getRecentPropertyEmailsForDashboardSafe } from "@/lib/db/gmail-queries";
import { getDashboardDataSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

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
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAwayLabel(d: Date): string {
  const diff = d.getTime() - Date.now();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Starting soon";
  if (hours < 24) return `In ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

export default async function DashboardPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const { userId: clerkUserId } = await auth();
  const idForQueries = clerkUserId ?? user?.id ?? undefined;
  const name = firstName(user);

  const [dash, recentEmails, checklistItems, activityItems] = await Promise.all([
    getDashboardDataSafe(idForQueries),
    getRecentPropertyEmailsForDashboardSafe(idForQueries, 5),
    getChecklistItems(),
    getRecentActivity(),
  ]);
  const { stats, recent, overview } = dash;
  const previewImages = recent
    .map((p) => p.imageUrl?.trim())
    .filter(Boolean) as string[];

  const hasUpcomingAuction = recent.some((p) => {
    if (!p.auctionDate) return false;
    const ad = new Date(p.auctionDate + "T00:00:00");
    return ad.getTime() - Date.now() < 14 * 86_400_000 && ad.getTime() > Date.now();
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 overflow-hidden">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-sm text-[#6B7280]">{todayLine()}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          {name ? `Hi, ${name}` : "Dashboard"}
        </h1>
        <p className="text-sm text-[#6B7280]">
          Overview of your search — open a section below to go deeper.
        </p>
      </div>

      {/* Next inspection hero */}
      {overview.nextInspection && (
        <NextInspectionHero
          address={overview.nextInspection.propertyLabel}
          dateLabel={formatInspectionWhen(overview.nextInspection.at)}
          timeAway={timeAwayLabel(overview.nextInspection.at)}
        />
      )}

      {/* Animated stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatedStatCard title="Total properties" value={stats.totalProperties} icon="building" />
        <AnimatedStatCard title="Upcoming inspections" value={stats.upcomingInspections} icon="calendarCheck" />
        <AnimatedStatCard title="Shortlisted" value={stats.shortlisted} icon="sparkles" />
        <AnimatedStatCard title="Attended" value={stats.inspectionsAttended} icon="listChecks" />
      </div>

      {/* Buying journey progress */}
      <BuyingJourney
        totalProperties={stats.totalProperties}
        inspectionsAttended={stats.inspectionsAttended}
        shortlisted={stats.shortlisted}
        hasUpcomingAuction={hasUpcomingAuction}
      />

      {/* Checklist + Activity side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChecklistSection items={checklistItems} />
        <ActivityFeed items={activityItems} />
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Properties */}
        <Link href="/properties" className="group block">
          <div className="relative h-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <Building2
              className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 rotate-12 text-[#0D9488]/[0.04]"
              strokeWidth={1}
              aria-hidden
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488] text-white shadow-sm shadow-[#0D9488]/25">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Properties</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#0D9488]">
                  {stats.totalProperties}
                </p>
                <p className="text-sm text-[#6B7280]">
                  saved {stats.totalProperties === 1 ? "property" : "properties"}
                </p>
              </div>
            </div>
            {previewImages.length > 0 ? (
              <div className="mt-4 flex gap-2">
                {previewImages.slice(0, 3).map((url) => (
                  <div key={url} className="relative h-12 w-16 overflow-hidden rounded-lg bg-[#F3F4F6] ring-1 ring-[#E5E7EB]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  </div>
                ))}
              </div>
            ) : null}
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D9488]">
              View all properties <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Inspections */}
        <Link href="/planner" className="group block">
          <div className="relative h-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CalendarDays
              className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 rotate-12 text-blue-500/[0.04]"
              strokeWidth={1}
              aria-hidden
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Inspections</p>
                <p className="mt-1">
                  <span className="text-2xl font-bold tabular-nums tracking-tight text-blue-600">{overview.saturdayOpenHomes}</span>
                  <span className="ml-1.5 text-sm font-medium text-[#374151]">this Saturday</span>
                </p>
                {overview.nextInspection ? (
                  <p className="mt-1.5 truncate text-sm text-[#6B7280]">
                    Next: {overview.nextInspection.propertyLabel}
                    <span className="mx-1 text-[#D1D5DB]">·</span>
                    <span className="font-medium text-blue-600">{timeAwayLabel(overview.nextInspection.at)}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-[#9CA3AF]">No upcoming inspections</p>
                )}
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
              Open route planner <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Agents */}
        <Link href="/agents" className="group block">
          <div className="relative h-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <Users
              className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 rotate-12 text-purple-500/[0.04]"
              strokeWidth={1}
              aria-hidden
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-600/25">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Agents</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-purple-600">
                  {overview.agentsTracked}
                </p>
                <p className="text-sm text-[#6B7280]">
                  {overview.agentsTracked === 1 ? "agent" : "agents"} tracked
                </p>
                <p className="mt-1.5 truncate text-sm text-[#374151]">
                  <span className="font-semibold tabular-nums text-purple-600">{overview.pendingChecklistItems}</span>{" "}
                  pending checklist {overview.pendingChecklistItems === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600">
              View agents <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Compare */}
        <Link href="/compare" className="group block">
          <div className="relative h-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <GitCompareArrows
              className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 rotate-12 text-amber-500/[0.04]"
              strokeWidth={1}
              aria-hidden
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/25">
                <GitCompareArrows className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Compare</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-amber-600">
                  {stats.shortlisted}
                </p>
                <p className="text-sm text-[#6B7280]">shortlisted</p>
                <p className="mt-1.5 text-sm text-[#374151]">
                  {stats.shortlisted >= 2
                    ? "Ready to compare side by side"
                    : "Shortlist 2+ properties to compare"}
                </p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
              {stats.shortlisted >= 2 ? "Compare now" : "View shortlist"} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </div>

      {/* Emails */}
      <RecentEmailsWidget emails={recentEmails} />
    </div>
  );
}
