"use client";

import { ChevronDown, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  addAgentNote,
  deleteAgentNote,
} from "@/app/actions/agent-notes";
import type {
  AgentNotePublic,
  AgentRatingSummary,
} from "@/lib/db/agent-queries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "communication", label: "Communication" },
  { value: "honesty", label: "Honesty" },
  { value: "negotiation", label: "Negotiation" },
  { value: "knowledge", label: "Market Knowledge" },
] as const;

const PROMPT_CHIPS = [
  "Did they quote accurately?",
  "Were they responsive?",
  "Did they push for higher price?",
  "Were they honest about defects?",
  "Would you use them again?",
];

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  communication: "Communication",
  honesty: "Honesty",
  negotiation: "Negotiation",
  knowledge: "Market Knowledge",
};

const CATEGORY_PILL: Record<string, string> = {
  general: "bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]",
  communication: "bg-blue-50 text-blue-800 ring-blue-100",
  honesty: "bg-amber-50 text-amber-900 ring-amber-100",
  negotiation: "bg-purple-50 text-purple-900 ring-purple-100",
  knowledge: "bg-teal-50 text-teal-900 ring-teal-100",
};

function formatRelativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? "" : "s"} ago`;
  const week = Math.floor(day / 7);
  if (week < 8) return `${week} week${week === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StarRow({
  value,
  max = 5,
  size = "md",
}: {
  value: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(h, i < filled ? "fill-current" : "fill-none")}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

type Props = {
  agentId: string;
  currentUserId: string;
  initialNotes: AgentNotePublic[];
  initialSummary: AgentRatingSummary;
};

export function AgentPerformanceNotesSection({
  agentId,
  currentUserId,
  initialNotes,
  initialSummary,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [summary, setSummary] = useState(initialSummary);
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
    setSummary(initialSummary);
  }, [initialNotes, initialSummary]);

  const hasNotes = notes.length > 0;

  const recomputeSummary = useMemo(
    () => (list: AgentNotePublic[]) => {
      const rated = list.filter(
        (n) => n.rating != null && n.rating >= 1 && n.rating <= 5,
      );
      const avg =
        rated.length === 0
          ? null
          : Math.round(
              (rated.reduce((s, n) => s + (n.rating as number), 0) /
                rated.length) *
                10,
            ) / 10;
      const catMap = new Map<string, { ratings: number[]; count: number }>();
      for (const n of list) {
        const c = (n.category?.trim() || "general").toLowerCase();
        if (!catMap.has(c)) catMap.set(c, { ratings: [], count: 0 });
        const e = catMap.get(c)!;
        e.count += 1;
        if (n.rating != null && n.rating >= 1 && n.rating <= 5) {
          e.ratings.push(n.rating);
        }
      }
      const byCategory = Array.from(catMap.entries())
        .map(([category, v]) => ({
          category,
          count: v.count,
          averageRating:
            v.ratings.length === 0
              ? null
              : Math.round(
                  (v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) *
                    10,
                ) / 10,
        }))
        .sort((a, b) => b.count - a.count);
      setSummary({
        averageRating: avg,
        ratedCount: rated.length,
        noteCount: list.length,
        byCategory,
      });
    },
    [],
  );

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await addAgentNote(agentId, text, rating, category);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setText("");
    setRating(null);
    setCategory("general");
    setFormOpen(false);
    router.refresh();
  }

  async function onDelete(noteId: string) {
    setDeletingId(noteId);
    setError(null);
    const res = await deleteAgentNote(noteId);
    setDeletingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next = notes.filter((n) => n.id !== noteId);
    setNotes(next);
    recomputeSummary(next);
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
        Performance notes
      </h2>

      {hasNotes && summary.noteCount > 0 ? (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#111827]">
              Rating summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.averageRating != null && summary.ratedCount > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-bold tabular-nums text-[#111827]">
                  {summary.averageRating.toFixed(1)}
                </span>
                <StarRow value={summary.averageRating} />
                <span className="text-sm text-[#6B7280]">
                  Based on {summary.noteCount}{" "}
                  {summary.noteCount === 1 ? "note" : "notes"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-[#6B7280]">
                No star ratings yet — add a rating with your next note.
              </p>
            )}
            {summary.averageRating == null || summary.ratedCount === 0 ? (
              <p className="text-xs text-[#6B7280]">
                {summary.noteCount}{" "}
                {summary.noteCount === 1 ? "note" : "notes"} total
              </p>
            ) : null}
            {summary.byCategory.length > 1 ? (
              <div className="space-y-2 border-t border-[#F3F4F6] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  By category
                </p>
                <ul className="flex flex-wrap gap-2">
                  {summary.byCategory.map((c) => (
                    <li
                      key={c.category}
                      className="rounded-lg bg-[#F9FAFB] px-2.5 py-1 text-xs text-[#374151]"
                    >
                      {CATEGORY_LABEL[c.category] ?? c.category}:{" "}
                      {c.averageRating != null ? (
                        <span className="font-semibold tabular-nums">
                          {c.averageRating.toFixed(1)}★
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">no ratings</span>
                      )}
                      <span className="text-[#9CA3AF]"> · {c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="border-[#0D9488] text-[#0D9488] hover:bg-[#ECFDF5]"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? "Cancel" : "+ Add note"}
          <ChevronDown
            className={cn(
              "ml-1 h-4 w-4 transition-transform",
              formOpen && "rotate-180",
            )}
          />
        </Button>

        {formOpen ? (
          <Card className="border-[#E5E7EB] bg-[#FAFAFA] shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-xs font-medium text-[#6B7280]">
                  Your note
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Pushed hard on price, quoted low and sold well above. Don't trust initial price guidance."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none ring-[#0D9488]/20 focus:ring-2"
                />
              </div>
              <div>
                <span className="text-xs font-medium text-[#6B7280]">
                  Rating (optional)
                </span>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setRating((r) => (r === n ? null : n))
                      }
                      className="rounded-md p-1 text-amber-500 transition-colors hover:bg-amber-50"
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className={cn(
                          "h-7 w-7",
                          rating != null && n <= rating
                            ? "fill-current"
                            : "fill-none",
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="agent-note-category"
                  className="text-xs font-medium text-[#6B7280]"
                >
                  Category
                </label>
                <select
                  id="agent-note-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]"
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                className="bg-[#0D9488] text-white hover:bg-[#0F766E]"
                disabled={saving || !text.trim()}
                onClick={onSave}
              >
                {saving ? "Saving…" : "Save note"}
              </Button>
              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setFormOpen(true);
                setText((t) => (t.trim() ? `${t.trim()}\n\n${chip}` : chip));
              }}
              className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] transition-colors hover:border-[#0D9488]/40 hover:text-[#0D9488]"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-3">
          {notes.map((n) => {
            const cat = (n.category?.trim() || "general").toLowerCase();
            const pill =
              CATEGORY_PILL[cat] ?? CATEGORY_PILL.general;
            const canDelete = n.userId === currentUserId;
            return (
              <li
                key={n.id}
                className="group relative rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
              >
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    disabled={deletingId === n.id}
                    className="absolute right-2 top-2 rounded-md p-1 text-[#D1D5DB] opacity-0 transition-opacity hover:bg-[#F3F4F6] hover:text-[#6B7280] group-hover:opacity-100"
                    aria-label="Delete note"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                      pill,
                    )}
                  >
                    {CATEGORY_LABEL[cat] ?? cat}
                  </span>
                  {n.rating != null && n.rating >= 1 && n.rating <= 5 ? (
                    <StarRow value={n.rating} size="sm" />
                  ) : null}
                  <span className="text-xs text-[#9CA3AF]">
                    {formatRelativeTime(
                      n.createdAt instanceof Date
                        ? n.createdAt
                        : new Date(n.createdAt),
                    )}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#374151]">
                  {n.note}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[#6B7280]">
          No performance notes yet. Add how this agent behaved during your search.
        </p>
      )}
    </section>
  );
}
