"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Send,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import { useAigent } from "@/components/agent/aigent-modal";
import type { UrgentActionItem } from "@/app/actions/agent";

// ── Types ────────────────────────────────────────────────────────────

type PipelineProperty = {
  id: string;
  address: string;
  suburb: string;
  status: string;
  imageUrl: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  insight: string | null;
  stage: number;
  hasInspectionAttended: boolean;
  hasInspectionScheduled: boolean;
  hasNotes: boolean;
  hasDocs: boolean;
  hasVoiceNotes: boolean;
};

type TimelineEvent = {
  id: string;
  date: string;
  dayLabel: string;
  time: string;
  title: string;
  type: "inspection" | "auction" | "followup";
  propertyId?: string;
};

type AgentCard = {
  id: string;
  name: string;
  agencyName: string | null;
  photoUrl: string | null;
  propertyCount: number;
  insight: string | null;
};

type SuburbCard = {
  suburb: string;
  postcode: string;
  insight: string | null;
};

const BRIEFING_DISMISS_STORAGE_KEY = "aigent-briefing-dismissed";

type Props = {
  conversationId: string;
  urgentActions: UrgentActionItem[];
  pipeline: PipelineProperty[];
  timeline: TimelineEvent[];
  agents: AgentCard[];
  suburbs: SuburbCard[];
  briefing: string | null;
  briefingHeaderDate: string;
  userFirstName: string;
};

// ── Component ────────────────────────────────────────────────────────

export function CommandCentre({
  conversationId,
  urgentActions,
  pipeline,
  timeline,
  agents,
  suburbs,
  briefing,
  briefingHeaderDate,
  userFirstName,
}: Props) {
  const { open: openAigent } = useAigent();
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  const dismissAction = (id: string) => {
    setDismissedActions((prev) => new Set(prev).add(id));
  };

  const visibleActions = urgentActions.filter((a) => !dismissedActions.has(a.id));
  const grouped = groupTimelineByDay(timeline);

  const handleChatSend = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    openAigent(msg);
  }, [chatInput, openAigent]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-3 sm:px-4 md:px-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
              Buyers Aigent
            </h1>
            <p className="text-sm text-[#6B7280]">
              Your personal property buying command centre
            </p>
          </div>
        </div>
      </div>

      <MorningBriefingCard
        briefing={briefing}
        userFirstName={userFirstName}
        headerDate={briefingHeaderDate}
      />

      {/* Section 1 — Urgent Actions (AI-generated) */}
      {visibleActions.length > 0 ? (
        <section>
          <SectionTitle icon={AlertTriangle} iconColor="text-red-500">
            Needs your attention
          </SectionTitle>
          <div className="mt-3 space-y-3">
            {visibleActions.map((a) => (
              <AIUrgentCard
                key={a.id}
                action={a}
                onDismiss={dismissAction}
                onAsk={openAigent}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              You&apos;re on track
            </p>
            <p className="text-xs text-emerald-600">
              No urgent actions right now
            </p>
          </div>
        </div>
      )}

      {/* Section 2 — Property Pipeline */}
      {pipeline.length > 0 && (
        <section>
          <SectionTitle icon={Building2} iconColor="text-[#0D9488]">
            Property pipeline
          </SectionTitle>
          <div className="mt-3 space-y-2">
            {pipeline.map((p) => (
              <PipelineCard
                key={p.id}
                property={p}
                expanded={expanded === p.id}
                onToggle={() =>
                  setExpanded((prev) => (prev === p.id ? null : p.id))
                }
                onAsk={openAigent}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3 — This Week Timeline */}
      {timeline.length > 0 && (
        <section>
          <SectionTitle icon={CalendarDays} iconColor="text-blue-500">
            This week
          </SectionTitle>
          <div className="mt-3 space-y-4">
            {grouped.map((day) => (
              <TimelineDay key={day.dayLabel} day={day} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4 — Agent Intelligence */}
      {agents.length > 0 && (
        <section>
          <SectionTitle icon={Users} iconColor="text-purple-500">
            Agent intelligence
          </SectionTitle>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {agents.map((a) => (
              <AgentIntelCard key={a.id} agent={a} onAsk={openAigent} />
            ))}
          </div>
        </section>
      )}

      {/* Section 5 — Suburb Watch */}
      {suburbs.length > 0 && (
        <section>
          <SectionTitle icon={MapPin} iconColor="text-amber-500">
            Suburb watch
          </SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suburbs.map((s) => (
              <SuburbWatchCard
                key={`${s.suburb}-${s.postcode}`}
                suburb={s}
                onAsk={openAigent}
              />
            ))}
          </div>
        </section>
      )}

      {/* Bottom Chat Bar — mb clears mobile bottom nav */}
      <div className="mb-16 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm md:mb-0">
        <div className="flex w-full min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-[#0D9488]" />
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChatSend();
              }
            }}
            placeholder="Ask your Buyers Aigent anything…"
            className="min-h-[40px] w-full min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1 text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none md:min-h-[36px] md:text-sm"
          />
          <button
            type="button"
            disabled={!chatInput.trim()}
            onClick={handleChatSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488] text-white transition-colors hover:bg-[#0F766E] disabled:opacity-40 md:h-9 md:w-9"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MorningBriefingCard({
  briefing,
  userFirstName,
  headerDate,
}: {
  briefing: string | null;
  userFirstName: string;
  headerDate: string;
}) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      if (typeof window !== "undefined") {
        setDismissed(
          localStorage.getItem(BRIEFING_DISMISS_STORAGE_KEY) === today,
        );
      }
    } finally {
      setReady(true);
    }
  }, []);

  const dismiss = () => {
    const today = new Date().toLocaleDateString("en-CA");
    localStorage.setItem(BRIEFING_DISMISS_STORAGE_KEY, today);
    setDismissed(true);
  };

  if (!ready || !briefing?.trim() || dismissed) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-teal-50 shadow-md">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <Sun
              className="h-5 w-5 shrink-0 text-amber-500 sm:h-6 sm:w-6"
              strokeWidth={2}
            />
            <div className="min-w-0 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
                Your morning briefing
              </p>
              <h2 className="text-base font-bold leading-snug text-blue-950 sm:text-lg">
                <span className="sm:whitespace-nowrap">Good morning {userFirstName}</span>
                <span className="text-blue-800"> · {headerDate}</span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1.5 text-blue-400 transition-colors hover:bg-white/60 hover:text-blue-700"
            aria-label="Dismiss briefing"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="prose prose-sm max-w-none text-blue-950 prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-base prose-headings:font-bold prose-headings:text-blue-950 prose-p:my-2 prose-p:text-sm prose-p:leading-relaxed sm:prose-p:text-[15px] prose-ul:my-2 prose-li:my-0.5">
          <ReactMarkdown>{briefing}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionTitle({
  children,
  icon: Icon,
  iconColor,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-[#111827]">
      <Icon className={cn("h-5 w-5", iconColor)} />
      {children}
    </h2>
  );
}

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-400",
  medium: "border-l-[#0D9488]",
};

function AIUrgentCard({
  action,
  onDismiss,
  onAsk,
}: {
  action: UrgentActionItem;
  onDismiss: (id: string) => void;
  onAsk: (msg: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 overflow-hidden rounded-xl border border-[#E5E7EB] border-l-4 bg-white p-4 shadow-sm",
        PRIORITY_BORDER[action.priority] ?? "border-l-[#0D9488]",
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold text-[#111827]">
          {action.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-[#6B7280]">
          {action.reason}
        </p>
        <button
          type="button"
          onClick={() => onAsk(action.suggestedMessage)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#0D9488]/10 px-2.5 py-2 text-xs font-medium text-[#0D9488] transition-colors hover:bg-[#0D9488]/20 md:inline-flex md:w-auto md:justify-start md:py-1"
        >
          <Sparkles className="h-3 w-3" /> Ask Aigent how →
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(action.id)}
        className="shrink-0 rounded p-1 text-[#D1D5DB] transition-colors hover:text-[#6B7280]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const STAGES = [
  "Saved",
  "Inspected",
  "Shortlisted",
  "Due Diligence",
  "Offer/Auction",
  "Purchased",
] as const;

function PipelineCard({
  property: p,
  expanded,
  onToggle,
  onAsk,
}: {
  property: PipelineProperty;
  expanded: boolean;
  onToggle: () => void;
  onAsk: (msg: string) => void;
}) {
  const auctionWithin14Days = (() => {
    if (!p.auctionDate) return false;
    const ad = new Date(p.auctionDate + "T00:00:00");
    const now = new Date();
    return ad >= now && ad.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000;
  })();

  const nextActions = getSmartNextActions(p, auctionWithin14Days);

  const stageBadgeLabel = STAGES[p.stage] ?? "Saved";

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#F9FAFB]"
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6]">
            <Building2 className="h-6 w-6 text-[#D1D5DB]" />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-semibold text-[#111827]">
              {p.address}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                p.status === "purchased"
                  ? "bg-emerald-50 text-emerald-600"
                  : p.status === "shortlisted"
                    ? "bg-amber-50 text-amber-600"
                    : p.stage >= 1
                      ? "bg-blue-50 text-blue-600"
                      : "bg-[#F3F4F6] text-[#6B7280]",
              )}
            >
              {stageBadgeLabel}
            </span>
          </div>
          <p className="truncate text-xs text-[#6B7280]">{p.suburb}</p>
          {p.insight && (
            <p className="mt-1 line-clamp-2 text-xs italic text-[#0D9488]">
              {p.insight}
            </p>
          )}
        </div>
        {/* Stage dots */}
        <div className="hidden items-center gap-1 sm:flex">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-2 w-2 rounded-full",
                i <= p.stage ? "bg-[#0D9488]" : "bg-[#E5E7EB]",
              )}
              title={s}
            />
          ))}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
          {/* Stage progress bar */}
          <div className="mb-3 flex flex-wrap items-center gap-1">
            {STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={cn(
                    "flex h-6 items-center rounded-full px-2 text-[10px] font-semibold",
                    i < p.stage
                      ? "bg-[#0D9488]/70 text-white"
                      : i === p.stage
                        ? "bg-[#0D9488] text-white ring-2 ring-[#0D9488]/30"
                        : "bg-[#E5E7EB] text-[#9CA3AF]",
                  )}
                >
                  {s}
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-3",
                      i < p.stage ? "bg-[#0D9488]" : "bg-[#E5E7EB]",
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {p.insight && (
            <p className="mb-3 text-sm italic text-[#0D9488]">{p.insight}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {nextActions.map((action) =>
              action.href ? (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-sm ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F3F4F6]"
                >
                  {action.label} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : action.msg ? (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onAsk(action.msg!)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-sm ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F3F4F6]"
                >
                  {action.label} <ArrowRight className="h-3 w-3" />
                </button>
              ) : null,
            )}
            <button
              type="button"
              onClick={() =>
                onAsk(
                  `Tell me everything I should know about ${p.address}, ${p.suburb}. What are the key risks and opportunities?`,
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488]/10 px-3 py-1.5 text-xs font-semibold text-[#0D9488] transition-colors hover:bg-[#0D9488]/20"
            >
              <Sparkles className="h-3 w-3" /> Ask Aigent about this property
            </button>
            <Link
              href={`/properties/${p.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#111827]"
            >
              View details <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

type NextAction = { label: string; href?: string; msg?: string };

function getSmartNextActions(p: PipelineProperty, auctionWithin14Days: boolean): NextAction[] {
  const actions: NextAction[] = [];

  if (auctionWithin14Days) {
    actions.push({
      label: "Get auction strategy",
      msg: `Give me a full auction strategy for ${p.address}. What should I budget, what's the bidding plan, and what due diligence do I need before auction day?`,
    });
  }

  if (p.stage === 0 && !p.hasInspectionScheduled) {
    actions.push({ label: "Schedule inspection", href: "/planner" });
  } else if (p.stage === 0 && p.hasInspectionScheduled) {
    actions.push({
      label: "Prepare for inspection",
      msg: `I have an upcoming inspection at ${p.address}. What should I look for? What questions should I ask the agent?`,
    });
  } else if (p.stage === 1 && !p.hasNotes) {
    actions.push({ label: "Add inspection notes", href: `/properties/${p.id}` });
  } else if (p.stage === 1 && p.hasNotes) {
    actions.push({
      label: "Get due diligence checklist",
      msg: `I've inspected ${p.address} and have my notes. What due diligence should I do next? Give me a full checklist.`,
    });
  } else if (p.stage === 2) {
    actions.push({
      label: "Start due diligence",
      msg: `I've shortlisted ${p.address}. Walk me through the complete due diligence process — strata, building inspection, contract review, comparable sales.`,
    });
  } else if (p.stage === 3) {
    actions.push({
      label: "Review progress",
      msg: `What's left on my due diligence for ${p.address}? Am I ready to make an offer?`,
    });
  }

  return actions;
}

const EVENT_COLORS: Record<string, { dot: string; text: string }> = {
  auction: { dot: "bg-red-500", text: "text-red-700" },
  inspection: { dot: "bg-[#0D9488]", text: "text-[#111827]" },
  followup: { dot: "bg-[#9CA3AF]", text: "text-[#6B7280]" },
};

type GroupedDay = {
  dayLabel: string;
  events: TimelineEvent[];
  hasAuction: boolean;
};

function groupTimelineByDay(events: TimelineEvent[]): GroupedDay[] {
  const map = new Map<string, GroupedDay>();
  for (const e of events) {
    let day = map.get(e.dayLabel);
    if (!day) {
      day = { dayLabel: e.dayLabel, events: [], hasAuction: false };
      map.set(e.dayLabel, day);
    }
    day.events.push(e);
    if (e.type === "auction") day.hasAuction = true;
  }
  return Array.from(map.values());
}

function TimelineDay({ day }: { day: GroupedDay }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:gap-4">
      <div className="shrink-0 pt-0.5 md:w-24">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide md:text-xs",
            day.hasAuction ? "text-red-600" : "text-[#6B7280]",
          )}
        >
          {day.dayLabel}
        </p>
      </div>
      <div className="relative min-w-0 flex-1 border-l-2 border-[#E5E7EB] pl-3 md:pl-4">
        <div
          className={cn(
            "absolute -left-[5px] top-1.5 h-2 w-2 rounded-full",
            day.hasAuction ? "bg-red-500" : "bg-[#0D9488]",
          )}
        />
        <div className="space-y-1.5 md:space-y-2">
          {day.events.map((e) => {
            const colors = EVENT_COLORS[e.type] ?? EVENT_COLORS.followup;
            return (
              <div
                key={e.id}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
              >
                <span className="shrink-0 text-[10px] font-medium tabular-nums text-[#6B7280] md:text-xs">
                  {e.time}
                </span>
                <span
                  className={cn(
                    "min-w-0 text-xs font-medium leading-snug md:text-sm",
                    colors.text,
                  )}
                >
                  {e.type === "auction" && (
                    <span className="mr-1 font-bold text-red-600">AUCTION:</span>
                  )}
                  {e.title}
                </span>
              </div>
            );
          })}
          {day.events.some((e) => e.type === "inspection") && (
            <Link
              href="/planner"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0D9488] hover:underline md:text-xs"
            >
              View route → <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentIntelCard({
  agent,
  onAsk,
}: {
  agent: AgentCard;
  onAsk: (msg: string) => void;
}) {
  const initial = agent.name.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {agent.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple-600 ring-1 ring-purple-100">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#111827]">
            {agent.name}
          </p>
          {agent.agencyName && (
            <p className="truncate text-xs text-[#6B7280]">
              {agent.agencyName}
            </p>
          )}
          <p className="mt-1 text-xs text-[#9CA3AF]">
            {agent.propertyCount} propert{agent.propertyCount === 1 ? "y" : "ies"} linked
          </p>
          {agent.insight && (
            <p className="mt-1.5 line-clamp-2 text-xs italic leading-relaxed text-purple-600">
              {agent.insight}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          onAsk(
            `Tell me about ${agent.name}${agent.agencyName ? " from " + agent.agencyName : ""}. What should I know when dealing with them?`,
          )
        }
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-100"
      >
        <Sparkles className="h-3 w-3" />
        Ask Aigent about {agent.name.split(" ")[0]}
      </button>
    </div>
  );
}

function SuburbWatchCard({
  suburb: s,
  onAsk,
}: {
  suburb: SuburbCard;
  onAsk: (msg: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="truncate text-sm font-semibold text-[#111827]">
          {s.suburb}
        </p>
        <span className="text-xs text-[#9CA3AF]">{s.postcode}</span>
      </div>
      {s.insight && (
        <p className="mt-1.5 text-xs italic leading-relaxed text-amber-700">
          {s.insight}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Link
          href={`/suburbs/${s.suburb.toLowerCase().replace(/\s+/g, "-")}-${s.postcode}`}
          className="text-xs font-medium text-[#6B7280] hover:text-[#111827]"
        >
          View suburb →
        </Link>
        <button
          type="button"
          onClick={() =>
            onAsk(
              `Give me a buyers agent perspective on ${s.suburb} ${s.postcode}. Is it a good time to buy?`,
            )
          }
          className="text-xs font-semibold text-[#0D9488] hover:underline"
        >
          Ask Aigent →
        </button>
      </div>
    </div>
  );
}
