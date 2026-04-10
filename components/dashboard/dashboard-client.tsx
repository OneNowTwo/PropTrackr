"use client";

import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  ListChecks,
  Mail,
  Mic,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ActivityItem } from "@/app/actions/activity";
import type { ChecklistItem, ChecklistPriority } from "@/app/actions/checklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);

  return <>{display}</>;
}

// ---------------------------------------------------------------------------
// Stat card with animated count
// ---------------------------------------------------------------------------

const STAT_ICONS: Record<string, typeof Building2> = {
  building: Building2,
  calendarCheck: CalendarCheck,
  sparkles: Sparkles,
  listChecks: ListChecks,
};

export function AnimatedStatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  const Icon = STAT_ICONS[icon] ?? Building2;
  return (
    <Card className="overflow-hidden border-[#E5E7EB] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              {title}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-[#0D9488] sm:text-4xl">
              <AnimatedNumber value={value} />
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

// ---------------------------------------------------------------------------
// Next inspection hero card
// ---------------------------------------------------------------------------

export function NextInspectionHero({
  address,
  dateLabel,
  timeAway,
}: {
  address: string;
  dateLabel: string;
  timeAway: string;
}) {
  return (
    <Link href="/planner" className="group block">
      <Card className="border-l-4 border-l-[#0D9488] border-[#E5E7EB] bg-white shadow-sm transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0D9488]">
              Next inspection
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#111827]">
              {address}
            </p>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              {dateLabel} · <span className="font-medium text-[#374151]">{timeAway}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

const PRIORITY_DOT: Record<ChecklistPriority, string> = {
  urgent: "bg-red-500",
  upcoming: "bg-amber-500",
  action: "bg-[#0D9488]",
};

export function ChecklistSection({ items }: { items: ChecklistItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 8);

  if (items.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm font-semibold text-[#111827]">All caught up!</p>
          <p className="text-xs text-[#6B7280]">No actions need your attention right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          What needs your attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-4">
        {visible.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F9FAFB]"
          >
            <span
              className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", PRIORITY_DOT[item.priority])}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#111827]">{item.title}</p>
              {item.subtitle && (
                <p className="mt-0.5 truncate text-xs text-[#6B7280]">{item.subtitle}</p>
              )}
            </div>
          </Link>
        ))}
        {items.length > 8 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="ml-3 mt-1 text-xs font-semibold text-[#0D9488] hover:underline"
          >
            See all ({items.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<string, typeof Home> = {
  property_saved: Home,
  inspection_attended: CalendarCheck,
  voice_note: Mic,
  email: Mail,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <Clock className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-4">
        {items.map((item) => {
          const Icon = ACTIVITY_ICONS[item.type] ?? Home;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#F9FAFB]"
            >
              <Icon className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              <span className="min-w-0 flex-1 truncate text-sm text-[#374151]">
                {item.description}
              </span>
              <span className="shrink-0 text-xs text-[#9CA3AF]">{item.timestamp}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

type BuyingStage = "browsing" | "inspecting" | "shortlisting" | "offers" | "buying";

const STAGES: { key: BuyingStage; label: string; icon: typeof Building2 }[] = [
  { key: "browsing", label: "Browsing", icon: Building2 },
  { key: "inspecting", label: "Inspecting", icon: CalendarCheck },
  { key: "shortlisting", label: "Shortlisting", icon: Sparkles },
  { key: "offers", label: "Making Offers", icon: ListChecks },
  { key: "buying", label: "Buying", icon: Home },
];

export function BuyingJourney({
  totalProperties,
  inspectionsAttended,
  shortlisted,
  hasUpcomingAuction,
}: {
  totalProperties: number;
  inspectionsAttended: number;
  shortlisted: number;
  hasUpcomingAuction: boolean;
}) {
  let current: BuyingStage = "browsing";
  if (hasUpcomingAuction) current = "offers";
  else if (shortlisted > 0) current = "shortlisting";
  else if (inspectionsAttended > 0) current = "inspecting";
  else if (totalProperties > 0) current = "browsing";

  const currentIdx = STAGES.findIndex((s) => s.key === current);

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Your buying journey
        </p>
        <div className="mt-4 flex items-center">
          {STAGES.map((stage, i) => {
            const isActive = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                      isCurrent
                        ? "bg-[#0D9488] text-white shadow-md"
                        : isActive
                          ? "bg-[#0D9488]/20 text-[#0D9488]"
                          : "bg-[#F3F4F6] text-[#9CA3AF]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-tight",
                      isCurrent ? "text-[#0D9488]" : isActive ? "text-[#374151]" : "text-[#9CA3AF]",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 h-0.5 flex-1",
                      i < currentIdx ? "bg-[#0D9488]/40" : "bg-[#E5E7EB]",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
