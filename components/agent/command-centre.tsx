"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  MapPin,
  Send,
  Sparkles,
  Square,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import { cn } from "@/lib/utils";
import { useAigent } from "@/components/agent/aigent-modal";
import { HelpTooltip } from "@/components/ui/help-tooltip";
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
  /** Next inspection within 7 days (calendar days from today). */
  nextInspectionDays: number | null;
  /** Fresh AI checklist exists (generated in last 7 days). */
  hasAiInspectionChecklist: boolean;
  hasNotes: boolean;
  hasDocs: boolean;
  hasVoiceNotes: boolean;
  hasBuildingDocHint: boolean;
  hasStrataDocHint: boolean;
  hasLegalDocHint: boolean;
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
const BRIEFING_COLLAPSED_STORAGE_KEY = "aigent-briefing-collapsed";
const URGENT_ACTIONS_STORAGE_KEY = "aigent-urgent-actions-v1";
const PIPELINE_CHECKLIST_KEY = "aigent-pipeline-checklist-v1";

type UrgentPersist = {
  doneByDay: Record<string, string[]>;
  noted: string[];
  dismissed: string[];
};

function readUrgentPersist(): UrgentPersist {
  if (typeof window === "undefined") {
    return { doneByDay: {}, noted: [], dismissed: [] };
  }
  try {
    const raw = localStorage.getItem(URGENT_ACTIONS_STORAGE_KEY);
    if (!raw) return { doneByDay: {}, noted: [], dismissed: [] };
    const p = JSON.parse(raw) as Partial<UrgentPersist>;
    return {
      doneByDay: p.doneByDay ?? {},
      noted: p.noted ?? [],
      dismissed: p.dismissed ?? [],
    };
  } catch {
    return { doneByDay: {}, noted: [], dismissed: [] };
  }
}

function writeUrgentPersist(p: UrgentPersist) {
  localStorage.setItem(URGENT_ACTIONS_STORAGE_KEY, JSON.stringify(p));
}

type PipelineCheckManual = {
  buildingInspectionBooked?: boolean;
  financePreApproval?: boolean;
  comparablesResearched?: boolean;
};

function readPipelineChecklist(): Record<string, PipelineCheckManual> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PIPELINE_CHECKLIST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PipelineCheckManual>;
  } catch {
    return {};
  }
}

function writePipelineChecklist(data: Record<string, PipelineCheckManual>) {
  localStorage.setItem(PIPELINE_CHECKLIST_KEY, JSON.stringify(data));
}

const briefingCardMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-[#374151] last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#374151] marker:text-teal-600 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#374151] last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-teal-600">{children}</strong>
  ),
};

function useIsMdUp() {
  const [ok, setOk] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setOk(mq.matches);
    const fn = () => setOk(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return ok;
}

type Props = {
  conversationId: string;
  pipeline: PipelineProperty[];
  timeline: TimelineEvent[];
  agents: AgentCard[];
  suburbs: SuburbCard[];
  briefingHeaderDate: string;
  readiness: {
    percent: number;
    stepsDone: number;
    totalSteps: number;
    steps: Array<{
      id: string;
      label: string;
      weightPercent: number;
      done: boolean;
      askMessage: string;
    }>;
  };
  timelineTodayKey: string;
  timelineTomorrowKey: string;
  pipelineTotal: number;
  pipelineActiveCount: number;
  globalChecklistHints: { preApproval: boolean; compared: boolean };
};

// ── Component ────────────────────────────────────────────────────────

export function CommandCentre({
  conversationId: _conversationId,
  pipeline,
  timeline,
  agents,
  suburbs,
  briefingHeaderDate,
  readiness,
  timelineTodayKey,
  timelineTomorrowKey,
  pipelineTotal,
  pipelineActiveCount,
  globalChecklistHints,
}: Props) {
  const { open: openAigent } = useAigent();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [urgentActions, setUrgentActions] = useState<UrgentActionItem[]>([]);
  const [urgentLoading, setUrgentLoading] = useState(false);
  const [propertyOneLiners, setPropertyOneLiners] = useState<
    Record<string, string>
  >({});
  const [agentOneLiners, setAgentOneLiners] = useState<Record<string, string>>(
    {},
  );
  const [suburbOneLiners, setSuburbOneLiners] = useState<
    Record<string, string>
  >({});
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [urgentPersist, setUrgentPersist] = useState<UrgentPersist | null>(
    null,
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [agentsOpenMobile, setAgentsOpenMobile] = useState(false);
  const [suburbsOpenMobile, setSuburbsOpenMobile] = useState(false);
  const [timelineFullWeek, setTimelineFullWeek] = useState(false);

  useEffect(() => {
    setUrgentPersist(readUrgentPersist());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBriefingLoading(true);
      try {
        const res = await fetch("/api/agent/briefing");
        const data = (await res.json().catch(() => ({}))) as {
          briefing?: string | null;
        };
        if (!cancelled && res.ok) {
          setBriefing(
            typeof data.briefing === "string" ? data.briefing : null,
          );
        }
      } catch {
        if (!cancelled) setBriefing(null);
      } finally {
        if (!cancelled) setBriefingLoading(false);
      }

      if (cancelled) return;
      setUrgentLoading(true);
      try {
        const res = await fetch("/api/agent/urgent-actions");
        const data = (await res.json().catch(() => ({}))) as {
          urgentActions?: UrgentActionItem[];
        };
        if (!cancelled && res.ok && Array.isArray(data.urgentActions)) {
          setUrgentActions(data.urgentActions);
        } else if (!cancelled) setUrgentActions([]);
      } catch {
        if (!cancelled) setUrgentActions([]);
      } finally {
        if (!cancelled) setUrgentLoading(false);
      }

      if (cancelled) return;
      setInsightsLoading(true);
      try {
        const res = await fetch("/api/agent/insights");
        const data = (await res.json().catch(() => ({}))) as {
          propertyOneLiners?: Record<string, string>;
          agentOneLiners?: Record<string, string>;
          suburbOneLiners?: Record<string, string>;
        };
        if (!cancelled && res.ok) {
          setPropertyOneLiners(
            data.propertyOneLiners &&
              typeof data.propertyOneLiners === "object"
              ? data.propertyOneLiners
              : {},
          );
          setAgentOneLiners(
            data.agentOneLiners && typeof data.agentOneLiners === "object"
              ? data.agentOneLiners
              : {},
          );
          setSuburbOneLiners(
            data.suburbOneLiners && typeof data.suburbOneLiners === "object"
              ? data.suburbOneLiners
              : {},
          );
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pipelineWithInsights = useMemo(
    () =>
      pipeline.map((p) => ({
        ...p,
        insight: propertyOneLiners[p.id] ?? p.insight,
      })),
    [pipeline, propertyOneLiners],
  );

  const agentsWithInsights = useMemo(
    () =>
      agents.map((a) => ({
        ...a,
        insight: agentOneLiners[a.id] ?? a.insight,
      })),
    [agents, agentOneLiners],
  );

  const suburbsWithInsights = useMemo(
    () =>
      suburbs.map((s) => ({
        ...s,
        insight: suburbOneLiners[`${s.suburb}-${s.postcode}`] ?? s.insight,
      })),
    [suburbs, suburbOneLiners],
  );

  const todayKey =
    typeof window !== "undefined"
      ? new Date().toLocaleDateString("en-CA")
      : "";
  const persist = urgentPersist ?? {
    doneByDay: {},
    noted: [],
    dismissed: [],
  };
  const doneToday = new Set(persist.doneByDay[todayKey] ?? []);
  const notedSet = new Set(persist.noted);
  const dismissedSet = new Set(persist.dismissed);

  const patchUrgent = useCallback((next: UrgentPersist) => {
    writeUrgentPersist(next);
    setUrgentPersist(next);
  }, []);

  const visibleUrgent = urgentActions.filter(
    (a) => !dismissedSet.has(a.id) && !doneToday.has(a.id),
  );
  const activeUrgent = visibleUrgent.filter((a) => !notedSet.has(a.id));
  const notedUrgent = visibleUrgent.filter((a) => notedSet.has(a.id));
  const orderedUrgent = [...activeUrgent, ...notedUrgent];
  const doneTodayCount = (persist.doneByDay[todayKey] ?? []).length;

  const groupedAll = groupTimelineByDay(timeline);
  const filteredTimelineDays = groupedAll.filter(
    (d) =>
      d.sortDate === timelineTodayKey ||
      d.sortDate === timelineTomorrowKey,
  );
  const groupedTimeline = timelineFullWeek
    ? groupedAll
    : filteredTimelineDays.length > 0
      ? filteredTimelineDays
      : groupedAll;
  const showTimelineExpand =
    !timelineFullWeek &&
    filteredTimelineDays.length > 0 &&
    groupedAll.length > filteredTimelineDays.length;

  const handleChatSend = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    openAigent(msg);
  }, [chatInput, openAigent]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-3 sm:px-4 md:px-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                  Buyers Aigent
                </h1>
                <HelpTooltip
                  title="What is the Buyers Aigent?"
                  content="Your personal AI property advisor. It proactively guides you through buying — morning briefings, auction strategy, inspection prep — without you having to ask."
                />
              </div>
              <p className="text-sm text-[#6B7280]">
                Your personal property buying command centre
              </p>
            </div>
          </div>
        </div>
      </div>

      <MorningBriefingCard
        briefing={briefing}
        headerDate={briefingHeaderDate}
        loading={briefingLoading}
      />

      <ReadinessBreakdown readiness={readiness} onAsk={openAigent} />

      {/* Section 1 — Urgent Actions (AI-generated, client + API) */}
      {!briefingLoading && (
        <>
          {urgentLoading ? (
            <section className="border-t border-[#F3F4F6] pt-10">
              <SectionTitle icon={AlertTriangle} iconColor="text-red-500">
                Needs your attention
              </SectionTitle>
              <div className="mt-4 space-y-3">
                <UrgentActionSkeletonCard />
                <UrgentActionSkeletonCard />
                <UrgentActionSkeletonCard />
              </div>
            </section>
          ) : orderedUrgent.length > 0 ? (
            <section className="border-t border-[#F3F4F6] pt-10">
              <SectionTitle icon={AlertTriangle} iconColor="text-red-500">
                Needs your attention ({activeUrgent.length} remaining)
              </SectionTitle>
              <div className="mt-4 space-y-3">
                {orderedUrgent.map((a) => (
                  <AIUrgentCard
                    key={a.id}
                    action={a}
                    isNoted={notedSet.has(a.id)}
                    onAsk={openAigent}
                    persist={persist}
                    todayKey={todayKey}
                    onPatch={patchUrgent}
                  />
                ))}
              </div>
              {doneTodayCount > 0 && (
                <p className="mt-3 text-center text-xs text-[#9CA3AF]">
                  {doneTodayCount} item{doneTodayCount === 1 ? "" : "s"}{" "}
                  completed today
                </p>
              )}
            </section>
          ) : (
            <section className="border-t border-[#F3F4F6] pt-10">
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
            </section>
          )}
        </>
      )}

      {/* Section 2 — Property Pipeline */}
      {pipeline.length > 0 && (
        <section className="border-t border-[#F3F4F6] pt-10">
          <SectionTitle
            icon={Building2}
            iconColor="text-[#0D9488]"
            help={{
              title: "Property pipeline",
              content:
                "Shows where each property is in your buying journey — from first save through to offer or auction. The stage updates automatically based on your activity.",
            }}
          >
            Property pipeline ({pipelineActiveCount} of {pipelineTotal} active)
          </SectionTitle>
          <div className="mt-4 space-y-3">
            {pipelineWithInsights.map((p) => (
              <PipelineCard
                key={p.id}
                property={p}
                insightLoading={insightsLoading}
                expanded={expanded === p.id}
                onToggle={() =>
                  setExpanded((prev) => (prev === p.id ? null : p.id))
                }
                onAsk={openAigent}
                globalChecklistHints={globalChecklistHints}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3 — This Week Timeline */}
      {timeline.length > 0 && (
        <section className="border-t border-[#F3F4F6] pt-10">
          <SectionTitle icon={CalendarDays} iconColor="text-blue-500">
            This week
          </SectionTitle>
          <div className="mt-4 space-y-4">
            {groupedTimeline.map((day) => (
              <TimelineDay key={day.sortDate + day.dayLabel} day={day} />
            ))}
          </div>
          {showTimelineExpand && (
            <button
              type="button"
              onClick={() => setTimelineFullWeek(true)}
              className="mt-4 w-full rounded-lg py-2 text-center text-sm font-medium text-[#0D9488] hover:bg-[#0D9488]/5"
            >
              Show full week →
            </button>
          )}
        </section>
      )}

      {/* Section 4 — Agent Intelligence */}
      {agents.length > 0 && (
        <section className="border-t border-[#F3F4F6] pt-10">
          <div className="md:hidden">
            <div className="flex items-start gap-1">
              <button
                type="button"
                onClick={() => setAgentsOpenMobile((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm"
              >
                <Users className="h-5 w-5 shrink-0 text-purple-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold tracking-tight text-[#111827]">
                    Agent intelligence
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {agents.length} agent{agents.length === 1 ? "" : "s"}{" "}
                    tracked — tap to view
                  </p>
                </div>
                {agentsOpenMobile ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#9CA3AF]" />
                )}
              </button>
              <div className="shrink-0 pt-4">
                <HelpTooltip
                  title="Agent intelligence"
                  content="Every agent linked to your saved properties appears here. Add performance notes and star ratings after dealing with them. The Buyers Aigent uses these notes when advising you."
                />
              </div>
            </div>
            {agentsOpenMobile && (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {agentsWithInsights.map((a) => (
                  <AgentIntelCard
                    key={a.id}
                    agent={a}
                    insightLoading={insightsLoading}
                    onAsk={openAigent}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <SectionTitle
              icon={Users}
              iconColor="text-purple-500"
              help={{
                title: "Agent intelligence",
                content:
                  "Every agent linked to your saved properties appears here. Add performance notes and star ratings after dealing with them. The Buyers Aigent uses these notes when advising you.",
              }}
            >
              Agent intelligence
            </SectionTitle>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {agentsWithInsights.map((a) => (
                <AgentIntelCard
                  key={a.id}
                  agent={a}
                  insightLoading={insightsLoading}
                  onAsk={openAigent}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 5 — Suburb Watch */}
      {suburbs.length > 0 && (
        <section className="border-t border-[#F3F4F6] pt-10">
          <div className="md:hidden">
            <div className="flex items-start gap-1">
              <button
                type="button"
                onClick={() => setSuburbsOpenMobile((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm"
              >
                <MapPin className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold tracking-tight text-[#111827]">
                    Suburb watch
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {suburbs.length} suburb{suburbs.length === 1 ? "" : "s"}{" "}
                    followed — tap to view
                  </p>
                </div>
                {suburbsOpenMobile ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#9CA3AF]" />
                )}
              </button>
              <div className="shrink-0 pt-4">
                <HelpTooltip
                  title="Suburb watch"
                  content="Suburbs are automatically added when you save a property there. You can also manually follow any suburb to track its schools, lifestyle, and market data."
                />
              </div>
            </div>
            {suburbsOpenMobile && (
              <div className="mt-4 grid gap-3">
                {suburbsWithInsights.map((s) => (
                  <SuburbWatchCard
                    key={`${s.suburb}-${s.postcode}`}
                    suburb={s}
                    insightLoading={insightsLoading}
                    onAsk={openAigent}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <SectionTitle
              icon={MapPin}
              iconColor="text-amber-500"
              help={{
                title: "Suburb watch",
                content:
                  "Suburbs are automatically added when you save a property there. You can also manually follow any suburb to track its schools, lifestyle, and market data.",
              }}
            >
              Suburb watch
            </SectionTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suburbsWithInsights.map((s) => (
                <SuburbWatchCard
                  key={`${s.suburb}-${s.postcode}`}
                  suburb={s}
                  insightLoading={insightsLoading}
                  onAsk={openAigent}
                />
              ))}
            </div>
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

function UrgentActionSkeletonCard() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="h-4 w-2/3 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#F3F4F6]" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[#F3F4F6]" />
    </div>
  );
}

function MorningBriefingCard({
  briefing,
  headerDate,
  loading,
}: {
  briefing: string | null;
  headerDate: string;
  loading: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      if (typeof window !== "undefined") {
        setDismissed(
          localStorage.getItem(BRIEFING_DISMISS_STORAGE_KEY) === today,
        );
        setCollapsed(
          localStorage.getItem(BRIEFING_COLLAPSED_STORAGE_KEY) === today,
        );
      }
    } finally {
      setReady(true);
    }
  }, []);

  if (loading) {
    return (
      <>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gray-200" />
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="ml-auto h-3 w-24 rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-5/6 rounded bg-gray-200" />
            <div className="h-3 w-4/6 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-3/4 rounded bg-gray-200" />
          </div>
          <div className="mt-3 flex items-center gap-1">
            <div className="h-3 w-3 animate-spin rounded-full bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-200" />
          </div>
        </div>
        <p className="mt-1 text-center text-xs text-gray-400">
          Preparing your morning briefing...
        </p>
      </>
    );
  }

  const dismissGotIt = () => {
    const today = new Date().toLocaleDateString("en-CA");
    localStorage.setItem(BRIEFING_DISMISS_STORAGE_KEY, today);
    localStorage.removeItem(BRIEFING_COLLAPSED_STORAGE_KEY);
    setDismissed(true);
  };

  const readLater = () => {
    const today = new Date().toLocaleDateString("en-CA");
    localStorage.setItem(BRIEFING_COLLAPSED_STORAGE_KEY, today);
    setCollapsed(true);
  };

  const expandFromHeader = () => {
    try {
      localStorage.removeItem(BRIEFING_COLLAPSED_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCollapsed(false);
  };

  if (!ready || !briefing?.trim() || dismissed) return null;

  const headerRow = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Sun className="h-4 w-4 shrink-0 text-[#0D9488]" strokeWidth={2} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
          Morning briefing
        </span>
      </div>
      <span className="shrink-0 text-xs text-[#9CA3AF]">{headerDate}</span>
    </div>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={expandFromHeader}
        className="w-full rounded-xl border border-[#E5E7EB] border-l-4 border-l-[#0D9488] bg-[#F9FAFB] px-4 py-3 text-left shadow-sm transition-colors hover:bg-[#F3F4F6]"
      >
        {headerRow}
        <p className="mt-1 text-xs text-[#9CA3AF]">Tap to expand briefing</p>
      </button>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#E5E7EB] border-l-4 border-l-[#0D9488] bg-[#F9FAFB] shadow-sm">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="border-b border-[#E5E7EB] pb-3">{headerRow}</div>
        <div className="prose prose-sm mx-auto max-w-2xl pt-4 text-[#374151] prose-p:mb-3">
          <ReactMarkdown components={briefingCardMarkdownComponents}>
            {briefing}
          </ReactMarkdown>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-4">
          <button
            type="button"
            onClick={dismissGotIt}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0F766E]"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Got it, thanks
          </button>
          <button
            type="button"
            onClick={readLater}
            className="inline-flex items-center rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F9FAFB]"
          >
            Read later
          </button>
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
  help,
}: {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  help?: { title: string; content: string; link?: { text: string; href: string } };
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-[#111827]">
      <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
      <span className="min-w-0 flex-1">{children}</span>
      {help ? (
        <HelpTooltip title={help.title} content={help.content} link={help.link} />
      ) : null}
    </h2>
  );
}

function ReadinessBreakdown({
  readiness,
  onAsk,
}: {
  readiness: {
    percent: number;
    stepsDone: number;
    totalSteps: number;
    steps: Array<{
      id: string;
      label: string;
      weightPercent: number;
      done: boolean;
      askMessage: string;
    }>;
  };
  onAsk: (msg: string) => void;
}) {
  const isMdUp = useIsMdUp();
  const [stepsOpen, setStepsOpen] = useState(isMdUp);

  useEffect(() => {
    setStepsOpen(isMdUp);
  }, [isMdUp]);

  const pct = Math.min(100, Math.max(0, readiness.percent));

  const barSummary = (
    <>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[#111827]">
          Your buying readiness
        </p>
        <HelpTooltip
          title="Buying readiness score"
          content="This score tracks how prepared you are to buy. Complete each step to increase your readiness and reduce the risk of missing something important."
        />
      </div>
      <div className="mt-2 w-full rounded-full bg-gray-100 h-2">
        <div
          className="h-2 rounded-full bg-teal-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#6B7280]">
        {pct}% · {readiness.stepsDone} of {readiness.totalSteps} steps completed
      </p>
    </>
  );

  const stepsList = (
    <ul className="mt-4 space-y-3 border-t border-[#F3F4F6] pt-4">
      {readiness.steps.map((step) => (
        <li
          key={step.id}
          className={cn(
            "flex gap-2.5 text-sm",
            step.done ? "text-[#9CA3AF]" : "text-[#111827]",
          )}
        >
          <span className="mt-0.5 shrink-0">
            {step.done ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center text-[#D1D5DB]">
                <Square className="h-4 w-4" strokeWidth={2} />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "leading-snug",
                  step.done && "line-through decoration-[#9CA3AF]",
                )}
              >
                {step.label}
              </span>
              <span className="text-[11px] font-medium text-[#9CA3AF]">
                (+{step.weightPercent}%)
              </span>
            </div>
            {!step.done && step.askMessage && (
              <button
                type="button"
                onClick={() => onAsk(step.askMessage)}
                className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0D9488] hover:underline"
              >
                Ask Aigent →
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="min-h-fit overflow-visible rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setStepsOpen((v) => !v)}
          className="flex w-full flex-col gap-1 text-left"
          aria-expanded={stepsOpen}
        >
          {barSummary}
          <span className="flex items-center justify-center gap-1 text-[11px] font-medium text-[#0D9488]">
            {stepsOpen ? (
              <>
                Hide steps <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                View steps & how to improve{" "}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        </button>
        {stepsOpen && stepsList}
      </div>

      <div className="hidden md:block">
        {barSummary}
        {stepsList}
      </div>
    </section>
  );
}

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-400",
  medium: "border-l-[#0D9488]",
};

function AIUrgentCard({
  action,
  isNoted,
  onAsk,
  persist,
  todayKey,
  onPatch,
}: {
  action: UrgentActionItem;
  isNoted: boolean;
  onAsk: (msg: string) => void;
  persist: UrgentPersist;
  todayKey: string;
  onPatch: (p: UrgentPersist) => void;
}) {
  const isMdUp = useIsMdUp();
  const [open, setOpen] = useState(isMdUp);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setOpen(isMdUp);
  }, [isMdUp]);

  const markDone = () => {
    setExiting(true);
    window.setTimeout(() => {
      const dayIds = [...(persist.doneByDay[todayKey] ?? [])];
      if (!dayIds.includes(action.id)) dayIds.push(action.id);
      onPatch({
        ...persist,
        doneByDay: { ...persist.doneByDay, [todayKey]: dayIds },
        noted: persist.noted.filter((id) => id !== action.id),
      });
    }, 480);
  };

  const markNoted = () => {
    if (persist.noted.includes(action.id)) return;
    onPatch({
      ...persist,
      noted: [...persist.noted, action.id],
    });
  };

  const markDismissed = () => {
    const dismissed = persist.dismissed.includes(action.id)
      ? persist.dismissed
      : [...persist.dismissed, action.id];
    onPatch({
      ...persist,
      dismissed,
      noted: persist.noted.filter((id) => id !== action.id),
    });
  };

  const reasonClass = cn(
    "text-xs leading-relaxed text-[#6B7280]",
    exiting && "text-[#9CA3AF] line-through decoration-[#9CA3AF]",
  );

  const actionsRow = (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-3 pb-4">
      <button
        type="button"
        onClick={markDone}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100"
      >
        <Check className="h-3 w-3" /> Done
      </button>
      <button
        type="button"
        onClick={markNoted}
        className="inline-flex items-center gap-1 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 text-[11px] font-semibold text-[#4B5563] ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F3F4F6]"
      >
        <Eye className="h-3 w-3" /> Noted
      </button>
      <button
        type="button"
        onClick={markDismissed}
        className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#9CA3AF] ring-1 ring-[#E5E7EB] transition-colors hover:bg-[#F9FAFB] hover:text-[#6B7280]"
      >
        <X className="h-3 w-3" /> Dismiss
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        "min-h-fit overflow-visible rounded-xl border border-[#E5E7EB] border-l-4 bg-white shadow-sm transition-opacity duration-300",
        PRIORITY_BORDER[action.priority] ?? "border-l-[#0D9488]",
        isNoted && "opacity-50",
        exiting && "opacity-60",
      )}
    >
      <div className="overflow-visible p-4 pb-0">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 overflow-visible">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 text-sm font-semibold text-[#111827] md:truncate",
                  exiting &&
                    "text-[#9CA3AF] line-through decoration-[#9CA3AF]",
                )}
              >
                {action.title}
              </p>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="shrink-0 rounded-lg p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] md:hidden"
              >
                {open ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="hidden md:block">
              <p className={cn("mt-0.5", reasonClass)}>{action.reason}</p>
              {action.checklistHref ? (
                <Link
                  href={action.checklistHref}
                  className="mt-2 inline-flex text-xs font-semibold text-[#0D9488] hover:underline"
                >
                  Open inspection checklist →
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => onAsk(action.suggestedMessage)}
                className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg bg-[#0D9488]/10 px-2.5 py-1 text-xs font-medium text-[#0D9488] transition-colors hover:bg-[#0D9488]/20"
              >
                <Sparkles className="h-3 w-3" /> Ask Aigent how →
              </button>
              {actionsRow}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out md:hidden",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-visible">
            <div className="overflow-visible pt-2">
              <p className={reasonClass}>{action.reason}</p>
              {action.checklistHref ? (
                <Link
                  href={action.checklistHref}
                  className="mt-2 flex w-full justify-center text-xs font-semibold text-[#0D9488] hover:underline"
                >
                  Open inspection checklist →
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => onAsk(action.suggestedMessage)}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#0D9488]/10 px-2.5 py-2 text-xs font-medium text-[#0D9488] transition-colors hover:bg-[#0D9488]/20"
              >
                <Sparkles className="h-3 w-3" /> Ask Aigent how →
              </button>
              {actionsRow}
            </div>
          </div>
        </div>
      </div>
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
  insightLoading,
  expanded,
  onToggle,
  onAsk,
  globalChecklistHints,
}: {
  property: PipelineProperty;
  insightLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAsk: (msg: string) => void;
  globalChecklistHints: { preApproval: boolean; compared: boolean };
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
          {insightLoading && !p.insight ? (
            <div className="mt-1 hidden h-3 w-4/5 animate-pulse rounded bg-[#E5E7EB] md:block" />
          ) : p.insight ? (
            <p className="mt-1 hidden line-clamp-2 text-xs italic text-[#0D9488] md:block">
              {p.insight}
            </p>
          ) : null}
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
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
        )}
      </button>

      <div
        className={cn(
          "grid border-[#E5E7EB] bg-[#F9FAFB] transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 py-3">
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

            {insightLoading && !p.insight ? (
              <div className="mb-3 h-4 w-full max-w-md animate-pulse rounded bg-[#E5E7EB]" />
            ) : p.insight ? (
              <p className="mb-3 text-sm italic text-[#0D9488]">{p.insight}</p>
            ) : null}

            {p.nextInspectionDays != null &&
            p.nextInspectionDays <= 7 &&
            !p.hasAiInspectionChecklist ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">
                  Inspection at {p.address} in {p.nextInspectionDays} day
                  {p.nextInspectionDays === 1 ? "" : "s"} — generate your
                  checklist
                </p>
                <Link
                  href={`/properties/${p.id}#inspection-checklist`}
                  className="mt-1 inline-flex text-xs font-semibold text-[#0D9488] hover:underline"
                >
                  Open inspection checklist →
                </Link>
              </div>
            ) : null}

            <PropertyPipelineChecklist
              property={p}
              globalChecklistHints={globalChecklistHints}
            />

            <div className="mt-3 flex flex-wrap gap-2">
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
        </div>
      </div>
    </div>
  );
}

function ChecklistTick({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none",
        checked
          ? "border-[#0D9488] bg-[#0D9488] text-white"
          : "border-[#D1D5DB] bg-white text-transparent",
      )}
      aria-hidden
    >
      {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function PropertyPipelineChecklist({
  property: p,
  globalChecklistHints,
}: {
  property: PipelineProperty;
  globalChecklistHints: { preApproval: boolean; compared: boolean };
}) {
  const [manual, setManual] = useState<PipelineCheckManual>({});

  useEffect(() => {
    setManual(readPipelineChecklist()[p.id] ?? {});
  }, [p.id]);

  const persistManual = (patch: PipelineCheckManual) => {
    const all = readPipelineChecklist();
    const next = { ...all, [p.id]: { ...(all[p.id] ?? {}), ...patch } };
    writePipelineChecklist(next);
    setManual(next[p.id] ?? {});
  };

  const m = manual;
  const financeChecked =
    globalChecklistHints.preApproval || !!m.financePreApproval;
  const comparablesChecked =
    globalChecklistHints.compared || !!m.comparablesResearched;

  return (
    <div className="mb-3 rounded-lg border border-[#E5E7EB] bg-white/80 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
        Progress checklist
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <ChecklistTick checked={p.hasInspectionAttended} />
          <span
            className={cn(
              "text-xs leading-snug",
              p.hasInspectionAttended ? "text-[#111827]" : "text-[#6B7280]",
            )}
          >
            Inspection attended
          </span>
        </li>
        <li className="flex items-start gap-2">
          <button
            type="button"
            onClick={() =>
              persistManual({
                buildingInspectionBooked: !m.buildingInspectionBooked,
              })
            }
            className="mt-0.5 shrink-0"
            aria-pressed={!!m.buildingInspectionBooked}
          >
            <ChecklistTick checked={!!m.buildingInspectionBooked} />
          </button>
          <button
            type="button"
            onClick={() =>
              persistManual({
                buildingInspectionBooked: !m.buildingInspectionBooked,
              })
            }
            className={cn(
              "text-left text-xs leading-snug",
              m.buildingInspectionBooked
                ? "text-[#111827]"
                : "text-[#6B7280]",
            )}
          >
            Building inspection booked
          </button>
        </li>
        <li className="flex items-start gap-2">
          <ChecklistTick checked={p.hasStrataDocHint} />
          <span
            className={cn(
              "text-xs leading-snug",
              p.hasStrataDocHint ? "text-[#111827]" : "text-[#6B7280]",
            )}
          >
            Strata report reviewed
            {p.hasStrataDocHint && (
              <span className="ml-1 text-[10px] text-[#9CA3AF]">
                (document on file)
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ChecklistTick checked={p.hasLegalDocHint} />
          <span
            className={cn(
              "text-xs leading-snug",
              p.hasLegalDocHint ? "text-[#111827]" : "text-[#6B7280]",
            )}
          >
            Contract reviewed by solicitor
            {p.hasLegalDocHint && (
              <span className="ml-1 text-[10px] text-[#9CA3AF]">
                (document on file)
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          {globalChecklistHints.preApproval ? (
            <ChecklistTick checked />
          ) : (
            <button
              type="button"
              onClick={() =>
                persistManual({
                  financePreApproval: !m.financePreApproval,
                })
              }
              className="mt-0.5 shrink-0"
              aria-pressed={!!m.financePreApproval}
            >
              <ChecklistTick checked={!!m.financePreApproval} />
            </button>
          )}
          <span
            className={cn(
              "text-xs leading-snug",
              financeChecked ? "text-[#111827]" : "text-[#6B7280]",
            )}
          >
            Finance pre-approval confirmed
            {globalChecklistHints.preApproval && (
              <span className="ml-1 text-[10px] text-[#9CA3AF]">
                (from your notes)
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2">
          {globalChecklistHints.compared ? (
            <ChecklistTick checked />
          ) : (
            <button
              type="button"
              onClick={() =>
                persistManual({
                  comparablesResearched: !m.comparablesResearched,
                })
              }
              className="mt-0.5 shrink-0"
              aria-pressed={!!m.comparablesResearched}
            >
              <ChecklistTick checked={!!m.comparablesResearched} />
            </button>
          )}
          <span
            className={cn(
              "text-xs leading-snug",
              comparablesChecked ? "text-[#111827]" : "text-[#6B7280]",
            )}
          >
            Comparable sales researched
            {globalChecklistHints.compared && (
              <span className="ml-1 text-[10px] text-[#9CA3AF]">
                (saved comparison)
              </span>
            )}
          </span>
        </li>
      </ul>
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
  sortDate: string;
  events: TimelineEvent[];
  hasAuction: boolean;
};

function groupTimelineByDay(events: TimelineEvent[]): GroupedDay[] {
  const map = new Map<string, GroupedDay>();
  for (const e of events) {
    let day = map.get(e.dayLabel);
    if (!day) {
      day = {
        dayLabel: e.dayLabel,
        sortDate: e.date,
        events: [],
        hasAuction: false,
      };
      map.set(e.dayLabel, day);
    }
    day.events.push(e);
    if (e.type === "auction") day.hasAuction = true;
    if (e.date < day.sortDate) day.sortDate = e.date;
  }
  const days = Array.from(map.values()).sort((a, b) =>
    a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0,
  );
  for (const d of days) {
    d.events.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }
  return days;
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
  insightLoading,
  onAsk,
}: {
  agent: AgentCard;
  insightLoading: boolean;
  onAsk: (msg: string) => void;
}) {
  const initial = agent.name.charAt(0).toUpperCase();
  const isMdUp = useIsMdUp();
  const [open, setOpen] = useState(isMdUp);

  useEffect(() => {
    setOpen(isMdUp);
  }, [isMdUp]);

  const askMsg = `Tell me about ${agent.name}${agent.agencyName ? " from " + agent.agencyName : ""}. What should I know when dealing with them?`;

  const expandedBody = (
    <>
      <p className="mt-1 text-xs text-[#9CA3AF] md:mt-1">
        {agent.propertyCount} propert{agent.propertyCount === 1 ? "y" : "ies"}{" "}
        linked
      </p>
      {insightLoading && !agent.insight ? (
        <div className="mt-1.5 h-3 w-full animate-pulse rounded bg-[#E5E7EB]" />
      ) : agent.insight ? (
        <p className="mt-1.5 text-xs italic leading-relaxed text-purple-600 md:line-clamp-none">
          {agent.insight}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => onAsk(askMsg)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-100"
      >
        <Sparkles className="h-3 w-3" />
        Ask Aigent about {agent.name.split(" ")[0]}
      </button>
    </>
  );

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
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#111827]">
                {agent.name}
              </p>
              {agent.agencyName && (
                <p className="truncate text-xs text-[#6B7280]">
                  {agent.agencyName}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="shrink-0 rounded-lg p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] md:hidden"
            >
              {open ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </div>
          <div className="hidden md:block">{expandedBody}</div>
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out md:hidden",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-2 pl-[52px]">{expandedBody}</div>
        </div>
      </div>
    </div>
  );
}

function SuburbWatchCard({
  suburb: s,
  insightLoading,
  onAsk,
}: {
  suburb: SuburbCard;
  insightLoading: boolean;
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
      {insightLoading && !s.insight ? (
        <div className="mt-1.5 h-3 max-w-sm animate-pulse rounded bg-[#E5E7EB] w-[92%]" />
      ) : s.insight ? (
        <p className="mt-1.5 text-xs italic leading-relaxed text-amber-700">
          {s.insight}
        </p>
      ) : null}
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
