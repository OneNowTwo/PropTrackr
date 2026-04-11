"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  MapPinned,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
} from "react";

import { createInspection, toggleInspectionAttended } from "@/app/actions/property-inspections";
import { useAigent } from "@/components/agent/aigent-modal";
import { PlannerRouteView } from "@/components/planner/planner-route-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PlannerInspectionRow } from "@/lib/db/queries";
import { INSPECTION_DURATION_OPTIONS } from "@/lib/property-detail-constants";
import {
  addDaysUtc,
  inspectionCalendarYmd,
  inspectionTimestampMs,
  utcMondayOfWeek,
  ymdUtc,
} from "@/lib/planner/inspection-dates";
import type { Property, PropertyStatus } from "@/types/property";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
);

function statusBadgeVariant(
  status: PropertyStatus,
): ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "shortlisted":
      return "success";
    case "inspecting":
      return "default";
    case "passed":
      return "muted";
    default:
      return "secondary";
  }
}

function formatStatusLabel(status: PropertyStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTimeLabel(time: string) {
  const [h, m] = time.split(":");
  const hour = Number.parseInt(h ?? "0", 10);
  const min = m ?? "00";
  if (!Number.isFinite(hour)) return time;
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

function formatWeekdayShortUtc(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(d);
}

function formatDayNumUtc(d: Date): string {
  return String(d.getUTCDate());
}

function formatMonthShortUtc(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(d);
}

type PlannerStats = {
  upcomingCount: number;
  thisSaturdayCount: number;
  attendedTotal: number;
  propertiesInspectedCount: number;
};

type Props = {
  inspections: PlannerInspectionRow[];
  properties: Property[];
  stats: PlannerStats;
};

export function PlannerClient({ inspections, properties, stats }: Props) {
  const router = useRouter();
  const { open: openAigent } = useAigent();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"calendar" | "list" | "route">("calendar");
  const [isMobile, setIsMobile] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isMobile && view === "calendar") setView("list");
  }, [isMobile, view]);

  const showRoute = view === "route";
  const showCalendar = !isMobile && view === "calendar";
  const showList = !showRoute && (isMobile || view === "list");

  const now = useMemo(() => new Date(), []);

  const weekStart = useMemo(() => {
    const mon = utcMondayOfWeek(now);
    return addDaysUtc(mon, weekOffset * 7);
  }, [now, weekOffset]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDaysUtc(weekStart, i));
    }
    return days;
  }, [weekStart]);

  const byDayYmd = useMemo(() => {
    const map = new Map<string, PlannerInspectionRow[]>();
    for (const d of weekDays) {
      map.set(ymdUtc(d), []);
    }
    for (const row of inspections) {
      const key = inspectionCalendarYmd(row.inspectionDate);
      if (!map.has(key)) continue;
      map.get(key)!.push(row);
    }
    map.forEach((list) => {
      list.sort((a, b) => inspectionTimestampMs(a) - inspectionTimestampMs(b));
    });
    return map;
  }, [inspections, weekDays]);

  const { upcomingList, pastList } = useMemo(() => {
    const t = Date.now();
    const upcoming = inspections
      .filter((r) => inspectionTimestampMs(r) >= t)
      .sort((a, b) => inspectionTimestampMs(a) - inspectionTimestampMs(b));
    const past = inspections
      .filter((r) => inspectionTimestampMs(r) < t)
      .sort((a, b) => inspectionTimestampMs(b) - inspectionTimestampMs(a));
    return { upcomingList: upcoming, pastList: past };
  }, [inspections]);

  const saturdayInspections = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const daysUntilSat = dayOfWeek <= 6 ? (6 - dayOfWeek) % 7 : 0;
    const sat = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + (daysUntilSat === 0 && dayOfWeek === 6 ? 0 : daysUntilSat)));
    const satYmd = ymdUtc(sat);
    return inspections.filter(
      (r) => inspectionCalendarYmd(r.inspectionDate) === satYmd,
    );
  }, [inspections]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  function onAddInspection(formData: FormData) {
    setAddError(null);
    startTransition(async () => {
      const r = await createInspection(formData);
      if (!r.ok) {
        setAddError(r.error);
        return;
      }
      setAddOpen(false);
      refresh();
    });
  }

  function onToggleAttended(id: string) {
    startTransition(async () => {
      await toggleInspectionAttended(id);
      refresh();
    });
  }

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return "";
    const y1 = start.getUTCFullYear();
    const y2 = end.getUTCFullYear();
    const m1 = formatMonthShortUtc(start);
    const m2 = formatMonthShortUtc(end);
    const d1 = formatDayNumUtc(start);
    const d2 = formatDayNumUtc(end);
    if (y1 !== y2) {
      return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
    }
    if (m1 === m2) {
      return `${d1}–${d2} ${m1} ${y1}`;
    }
    return `${d1} ${m1} – ${d2} ${m2} ${y1}`;
  }, [weekDays]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Inspection planner
          </h1>
          <p className="mt-1 text-[#6B7280]">
            Open homes and private inspections across your saved properties.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center rounded-lg border border-[#E5E7EB] bg-white p-0.5">
            <Button
              type="button"
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "gap-1.5",
                view === "calendar"
                  ? "bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                  : "text-[#6B7280]",
              )}
              aria-label="Calendar view"
              onClick={() => setView("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "gap-1.5",
                view === "list"
                  ? "bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                  : "text-[#6B7280]",
              )}
              aria-label="List view"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              type="button"
              variant={view === "route" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "gap-1.5",
                view === "route"
                  ? "bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                  : "text-[#6B7280]",
              )}
              aria-label="Route view"
              onClick={() => setView("route")}
            >
              <MapPinned className="h-4 w-4" />
              <span className="hidden sm:inline">Route</span>
            </Button>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="gap-2 bg-[#0D9488] font-medium text-white shadow-sm hover:bg-[#0D9488]/90"
              >
                <Plus className="h-4 w-4" />
                Add inspection
              </Button>
            </DialogTrigger>
            <DialogContent className="border-[#E5E7EB] bg-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#111827]">Add inspection</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  onAddInspection(new FormData(e.currentTarget));
                }}
              >
                {addError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {addError}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  <label htmlFor="planner-prop" className="text-sm font-medium text-[#111827]">
                    Property
                  </label>
                  <select
                    id="planner-prop"
                    name="propertyId"
                    required
                    className={selectClassName}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select a property
                    </option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.address}, {p.suburb}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="planner-date" className="text-sm font-medium text-[#111827]">
                    Date
                  </label>
                  <Input
                    id="planner-date"
                    name="inspectionDate"
                    type="date"
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="planner-time" className="text-sm font-medium text-[#111827]">
                    Time
                  </label>
                  <Input
                    id="planner-time"
                    name="inspectionTime"
                    type="time"
                    required
                    className="border-[#E5E7EB]"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="planner-dur" className="text-sm font-medium text-[#111827]">
                    Duration
                  </label>
                  <select
                    id="planner-dur"
                    name="durationMinutes"
                    required
                    defaultValue={30}
                    className={selectClassName}
                  >
                    {INSPECTION_DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="notes" value="" />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={pending || properties.length === 0}
                    className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                  >
                    {pending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PlannerStatsBar stats={stats} />

      {saturdayInspections.length > 0 && (
        <button
          type="button"
          onClick={() =>
            openAigent(
              `I have ${saturdayInspections.length} inspections this Saturday: ${saturdayInspections.map((i) => i.propertyAddress).join(", ")}. Give me a briefing on what to look for at each one and how to prepare.`,
            )
          }
          className="flex w-full items-center gap-3 rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3 text-left transition-colors hover:bg-[#0D9488]/10"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-[#0D9488]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#111827]">
              You have {saturdayInspections.length} inspection{saturdayInspections.length === 1 ? "" : "s"} this Saturday
            </p>
            <p className="text-xs text-[#0D9488]">
              Get your inspection briefing from Buyers Aigent →
            </p>
          </div>
        </button>
      )}

      {properties.length === 0 ? (
        <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="py-10 text-center text-sm text-[#6B7280]">
            Add a property first, then schedule inspections here or from a property page.
          </CardContent>
        </Card>
      ) : null}

      {showRoute && properties.length > 0 ? (
        <PlannerRouteView
          inspections={inspections}
          properties={properties}
        />
      ) : null}

      {showCalendar ? (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-4 pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-[#E5E7EB] bg-white"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-0 flex-1 text-center text-sm font-semibold text-[#111827]">
                {weekRangeLabel}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-[#E5E7EB] bg-white"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-x-auto border-t border-[#E5E7EB] pt-4">
              <div className="grid min-w-[720px] grid-cols-7 gap-2">
              {weekDays.map((day, colIndex) => {
                const ymd = ymdUtc(day);
                const dayRows = byDayYmd.get(ymd) ?? [];
                const isSaturday = colIndex === 5;
                return (
                  <div
                    key={ymd}
                    className={cn(
                      "flex min-h-[200px] flex-col rounded-lg border border-[#E5E7EB] p-2",
                      isSaturday ? "bg-[#0D9488]/[0.06]" : "bg-[#FAFAFA]",
                    )}
                  >
                    <div className="mb-2 border-b border-[#E5E7EB]/80 pb-2 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        {formatWeekdayShortUtc(day)}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-[#111827]">
                        {formatDayNumUtc(day)}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {dayRows.length === 0 ? (
                        <p className="py-4 text-center text-[11px] leading-snug text-[#9CA3AF]">
                          No inspections
                        </p>
                      ) : (
                        dayRows.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-md border border-[#E5E7EB] bg-white p-2 text-left shadow-sm"
                          >
                            <Link
                              href={`/properties/${row.propertyId}`}
                              className="block transition-shadow hover:opacity-90"
                            >
                              <p className="text-xs font-semibold text-[#0D9488]">
                                {formatTimeLabel(row.inspectionTime)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-[#111827]">
                                {row.propertyAddress}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">{row.propertySuburb}</p>
                              <div className="mt-2">
                                <Badge
                                  variant={statusBadgeVariant(row.propertyStatus)}
                                  className="text-[10px]"
                                >
                                  {formatStatusLabel(row.propertyStatus)}
                                </Badge>
                              </div>
                            </Link>
                            <Link
                              href={`/properties/${row.propertyId}#inspection-checklist`}
                              className="mt-1.5 block text-[10px] font-semibold text-[#0D9488] hover:underline"
                            >
                              View inspection checklist →
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showList ? (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-[#E5E7EB] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#111827]">
                {isMobile ? "Inspections" : "List view"}
              </h2>
              <p className="text-xs text-[#6B7280]">Sorted by date and time</p>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {upcomingList.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[#6B7280]">
                  No upcoming inspections.
                </p>
              ) : (
                upcomingList.map((row) => (
                  <ListRow
                    key={row.id}
                    row={row}
                    pending={pending}
                    onToggleAttended={onToggleAttended}
                  />
                ))
              )}
            </div>
            <details className="group border-t border-[#E5E7EB]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB] [&::-webkit-details-marker]:hidden">
                <span>Past inspections</span>
                <span className="flex items-center gap-1 text-xs font-normal text-[#6B7280]">
                  {pastList.length} total
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
                {pastList.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-[#6B7280]">
                    No past inspections.
                  </p>
                ) : (
                  pastList.map((row) => (
                    <ListRow
                      key={row.id}
                      row={row}
                      pending={pending}
                      onToggleAttended={onToggleAttended}
                    />
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PlannerStatsBar({ stats }: { stats: PlannerStats }) {
  const items = [
    { label: "Upcoming", value: stats.upcomingCount },
    { label: "This Saturday", value: stats.thisSaturdayCount },
    { label: "Attended (total)", value: stats.attendedTotal },
    { label: "Properties inspected", value: stats.propertiesInspectedCount },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium text-[#6B7280]">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ListRow({
  row,
  pending,
  onToggleAttended,
}: {
  row: PlannerInspectionRow;
  pending: boolean;
  onToggleAttended: (id: string) => void;
}) {
  const d = new Date(row.inspectionDate);
  const dateStr = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#111827]">
          <span className="font-medium">{dateStr}</span>
          <span className="text-[#6B7280]">·</span>
          <span className="font-semibold text-[#0D9488]">
            {formatTimeLabel(row.inspectionTime)}
          </span>
          {row.durationMinutes != null ? (
            <>
              <span className="text-[#6B7280]">·</span>
              <span className="text-[#6B7280]">{row.durationMinutes} min</span>
            </>
          ) : null}
        </div>
        <Link
          href={`/properties/${row.propertyId}`}
          className="block text-sm font-medium text-[#111827] hover:text-[#0D9488] hover:underline"
        >
          {row.propertyAddress}
          <span className="font-normal text-[#6B7280]">, {row.propertySuburb}</span>
        </Link>
        <Link
          href={`/properties/${row.propertyId}#inspection-checklist`}
          className="mt-1 inline-block text-xs font-semibold text-[#0D9488] hover:underline"
        >
          View inspection checklist →
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]">
          <input
            type="checkbox"
            checked={row.attended}
            disabled={pending}
            onChange={() => onToggleAttended(row.id)}
            className="h-4 w-4 rounded border-[#E5E7EB] text-[#0D9488] focus:ring-[#0D9488]"
          />
          Attended
        </label>
      </div>
    </div>
  );
}
