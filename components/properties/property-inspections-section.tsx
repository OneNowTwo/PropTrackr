"use client";

import { Calendar, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useAigent } from "@/components/agent/aigent-modal";

import {
  createInspection,
  deleteInspection,
  toggleInspectionAttended,
} from "@/app/actions/property-inspections";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Textarea } from "@/components/ui/textarea";
import type { InspectionRow } from "@/lib/db/queries";
import { INSPECTION_DURATION_OPTIONS } from "@/lib/property-detail-constants";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "flex h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
);

function formatInspectionDate(d: Date) {
  return new Date(d).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  propertyId: string;
  propertyAddress?: string;
  upcoming: InspectionRow[];
  past: InspectionRow[];
};

export function PropertyInspectionsSection({
  propertyId,
  propertyAddress,
  upcoming,
  past,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPostInspection, setShowPostInspection] = useState(false);
  const { open: openAigent } = useAigent();

  function refresh() {
    router.refresh();
  }

  function onCreate(formData: FormData) {
    setError(null);
    formData.set("propertyId", propertyId);
    startTransition(async () => {
      const r = await createInspection(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      refresh();
    });
  }

  function onToggle(id: string, wasAttended: boolean) {
    startTransition(async () => {
      await toggleInspectionAttended(id);
      if (!wasAttended) setShowPostInspection(true);
      refresh();
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Delete this inspection?")) return;
    startTransition(async () => {
      await deleteInspection(id);
      refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="text-base font-semibold text-[#111827]">
          Inspections
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
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
                onCreate(new FormData(e.currentTarget));
              }}
            >
              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="grid gap-2">
                <label htmlFor="insp-date" className="text-sm font-medium text-[#111827]">
                  Date
                </label>
                <Input
                  id="insp-date"
                  name="inspectionDate"
                  type="date"
                  required
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="insp-time" className="text-sm font-medium text-[#111827]">
                  Time
                </label>
                <Input
                  id="insp-time"
                  name="inspectionTime"
                  type="time"
                  required
                  className="border-[#E5E7EB]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="insp-dur" className="text-sm font-medium text-[#111827]">
                  Duration
                </label>
                <select
                  id="insp-dur"
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
              <div className="grid gap-2">
                <label htmlFor="insp-notes" className="text-sm font-medium text-[#111827]">
                  Notes (optional)
                </label>
                <Textarea
                  id="insp-notes"
                  name="notes"
                  rows={3}
                  className="resize-y border-[#E5E7EB]"
                  placeholder="Parking, access, what to check…"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                >
                  {pending ? "Saving…" : "Save inspection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-6">
        <InspectionList
          title="Upcoming"
          rows={upcoming}
          empty="No upcoming inspections."
          onToggle={onToggle}
          onDelete={onDelete}
          pending={pending}
        />
        <InspectionList
          title="Past"
          rows={past}
          empty="No past inspections."
          onToggle={onToggle}
          onDelete={onDelete}
          pending={pending}
        />
        {showPostInspection && (
          <div className="flex items-center gap-2 rounded-lg border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-[#0D9488]" />
            <p className="min-w-0 flex-1 text-sm text-[#374151]">
              How did it go?{" "}
              <button
                type="button"
                onClick={() =>
                  openAigent(
                    `I just attended the inspection at ${propertyAddress ?? "the property"}. What should I be thinking about now? What are the key follow-up steps?`,
                  )
                }
                className="font-semibold text-[#0D9488] hover:underline"
              >
                Get Buyers Aigent&apos;s post-inspection analysis →
              </button>
            </p>
            <button
              type="button"
              onClick={() => setShowPostInspection(false)}
              className="shrink-0 text-xs text-[#9CA3AF] hover:text-[#6B7280]"
            >
              Dismiss
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InspectionList({
  title,
  rows,
  empty,
  onToggle,
  onDelete,
  pending,
}: {
  title: string;
  rows: InspectionRow[];
  empty: string;
  onToggle: (id: string, wasAttended: boolean) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
        <Calendar className="h-4 w-4 text-[#0D9488]" />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[#6B7280]">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-[#111827]">
                  {formatInspectionDate(new Date(row.inspectionDate))} ·{" "}
                  {row.inspectionTime}
                  {row.durationMinutes != null
                    ? ` · ${row.durationMinutes} min`
                    : null}
                </p>
                {row.notes?.trim() ? (
                  <p className="text-sm text-[#6B7280]">{row.notes.trim()}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]">
                  <input
                    type="checkbox"
                    checked={row.attended}
                    disabled={pending}
                    onChange={() => onToggle(row.id, row.attended)}
                    className="h-4 w-4 rounded border-[#E5E7EB] text-[#0D9488] focus:ring-[#0D9488]/30"
                  />
                  Attended
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pending}
                  onClick={() => onDelete(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Delete</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
