"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { sendMessage } from "@/app/actions/agent";
import { useAigent } from "@/components/agent/aigent-modal";

// ── Types ────────────────────────────────────────────────────────────

type UrgentAction = {
  id: string;
  title: string;
  subtitle?: string;
  priority: "urgent" | "upcoming" | "action";
  href: string;
  type: string;
};

type PipelineProperty = {
  id: string;
  address: string;
  suburb: string;
  status: string;
  imageUrl: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  insight: string | null;
  hasInspection: boolean;
  hasNotes: boolean;
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
};

type SuburbCard = {
  suburb: string;
  postcode: string;
};

type Props = {
  conversationId: string;
  urgentActions: UrgentAction[];
  pipeline: PipelineProperty[];
  timeline: TimelineEvent[];
  agents: AgentCard[];
  suburbs: SuburbCard[];
};

// ── Component ────────────────────────────────────────────────────────

export function CommandCentre({
  conversationId,
  urgentActions,
  pipeline,
  timeline,
  agents,
  suburbs,
}: Props) {
  const { open: openAigent } = useAigent();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visibleUrgent = urgentActions.filter((a) => !dismissed.has(a.id));
  const grouped = groupTimelineByDay(timeline);

  const handleChatSend = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg || sending) return;
    setChatInput("");
    openAigent(msg);
  }, [chatInput, sending, openAigent]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Buyers Aigent
            </h1>
            <p className="text-sm text-[#6B7280]">
              Your personal property buying command centre
            </p>
          </div>
        </div>
      </div>

      {/* Section 1 — Urgent Actions */}
      {visibleUrgent.length > 0 ? (
        <section>
          <SectionTitle icon={AlertTriangle} iconColor="text-red-500">
            Needs your attention
          </SectionTitle>
          <div className="mt-3 space-y-3">
            {visibleUrgent.map((a) => (
              <UrgentCard key={a.id} action={a} onDismiss={dismiss} onAsk={openAigent} />
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <SuburbWatchCard key={`${s.suburb}-${s.postcode}`} suburb={s} onAsk={openAigent} />
            ))}
          </div>
        </section>
      )}

      {/* Bottom Chat Bar */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
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
            className="min-h-[36px] flex-1 rounded-lg border-0 bg-transparent px-2 py-1 text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none md:text-sm"
          />
          <button
            type="button"
            disabled={!chatInput.trim() || sending}
            onClick={handleChatSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D9488] text-white transition-colors hover:bg-[#0F766E] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
  upcoming: "border-l-amber-400",
  action: "border-l-[#0D9488]",
};

function UrgentCard({
  action,
  onDismiss,
  onAsk,
}: {
  action: UrgentAction;
  onDismiss: (id: string) => void;
  onAsk: (msg: string) => void;
}) {
  const askMsg =
    action.type === "auction"
      ? `What's my auction strategy for ${action.title.replace(/^Auction.*?:\s*/, "")}?`
      : action.type === "inspection"
        ? `What should I check at the inspection for ${action.title.replace(/^Inspection.*?:\s*/, "")}?`
        : `What should I do about: ${action.title}?`;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-[#E5E7EB] border-l-4 bg-white p-4 shadow-sm",
        PRIORITY_BORDER[action.priority] ?? "border-l-[#0D9488]",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#111827]">{action.title}</p>
        {action.subtitle && (
          <p className="mt-0.5 text-xs text-[#6B7280]">{action.subtitle}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#374151] transition-colors hover:bg-[#E5E7EB]"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => onAsk(askMsg)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488]/10 px-2.5 py-1 text-xs font-medium text-[#0D9488] transition-colors hover:bg-[#0D9488]/20"
          >
            <Sparkles className="h-3 w-3" /> Ask Aigent
          </button>
        </div>
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
] as const;

function statusToStage(status: string, hasAuction: boolean): number {
  if (hasAuction) return 4;
  switch (status) {
    case "shortlisted":
      return 2;
    case "inspecting":
      return 1;
    default:
      return 0;
  }
}

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
  const activeStage = statusToStage(p.status, !!p.auctionDate);

  const nextAction = (() => {
    if (p.auctionDate) return { label: "Get auction strategy", msg: `Give me auction strategy for ${p.address}` };
    if (p.status === "shortlisted") return { label: "Due diligence checklist", msg: `What due diligence should I do for ${p.address}?` };
    if (p.status === "inspecting" || p.hasInspection) return { label: "Add inspection notes", href: `/properties/${p.id}` };
    return { label: "Plan inspection", href: `/properties/${p.id}` };
  })();

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#111827]">
              {p.address}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                p.status === "shortlisted"
                  ? "bg-amber-50 text-amber-600"
                  : p.status === "inspecting"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-[#F3F4F6] text-[#6B7280]",
              )}
            >
              {p.status}
            </span>
          </div>
          <p className="truncate text-xs text-[#6B7280]">{p.suburb}</p>
          {p.insight && (
            <p className="mt-1 truncate text-xs italic text-[#0D9488]">
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
                i <= activeStage ? "bg-[#0D9488]" : "bg-[#E5E7EB]",
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
          <div className="mb-3 flex items-center gap-1">
            {STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={cn(
                    "flex h-6 items-center rounded-full px-2 text-[10px] font-semibold",
                    i <= activeStage
                      ? "bg-[#0D9488] text-white"
                      : "bg-[#E5E7EB] text-[#9CA3AF]",
                  )}
                >
                  {s}
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-3",
                      i < activeStage ? "bg-[#0D9488]" : "bg-[#E5E7EB]",
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
            {"href" in nextAction && nextAction.href ? (
              <Link
                href={nextAction.href}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-sm ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F3F4F6]"
              >
                {nextAction.label} <ArrowRight className="h-3 w-3" />
              </Link>
            ) : "msg" in nextAction && nextAction.msg ? (
              <button
                type="button"
                onClick={() => onAsk(nextAction.msg!)}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-sm ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F3F4F6]"
              >
                {nextAction.label} <ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
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
    <div className="flex gap-4">
      <div className="w-24 shrink-0 pt-0.5">
        <p
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            day.hasAuction ? "text-red-600" : "text-[#6B7280]",
          )}
        >
          {day.dayLabel}
        </p>
      </div>
      <div className="relative flex-1 border-l-2 border-[#E5E7EB] pl-4">
        <div
          className={cn(
            "absolute -left-[5px] top-1.5 h-2 w-2 rounded-full",
            day.hasAuction ? "bg-red-500" : "bg-[#0D9488]",
          )}
        />
        <div className="space-y-2">
          {day.events.map((e) => {
            const colors = EVENT_COLORS[e.type] ?? EVENT_COLORS.followup;
            return (
              <div key={e.id} className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs font-medium tabular-nums text-[#6B7280]">
                  {e.time}
                </span>
                <span className={cn("text-sm font-medium", colors.text)}>
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:underline"
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
            {agent.propertyCount} propert{agent.propertyCount === 1 ? "y" : "ies"} inspected
          </p>
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
