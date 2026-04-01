"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createNote, deleteNote } from "@/app/actions/property-notes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { PropertyNoteRow } from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/format-relative-time";

type Props = {
  propertyId: string;
  notes: PropertyNoteRow[];
};

export function PropertyNotesSection({ propertyId, notes }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("propertyId", propertyId);
    startTransition(async () => {
      const r = await createNote(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      formRef.current?.reset();
      refresh();
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    startTransition(async () => {
      await deleteNote(id);
      refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-[#111827]">
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          ref={formRef}
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
        >
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Textarea
            name="content"
            required
            rows={3}
            placeholder="Quick thoughts, agent comments, auction details…"
            className="resize-y border-[#E5E7EB] bg-white text-[#111827]"
          />
          <Button
            type="submit"
            disabled={pending}
            size="sm"
            className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
          >
            {pending ? "Adding…" : "Add note"}
          </Button>
        </form>

        <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
          {notes.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#6B7280]">
                      <MessageSquare className="h-3.5 w-3.5 text-[#0D9488]" />
                      {formatRelativeTime(new Date(n.createdAt))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={pending}
                      onClick={() => onDelete(n.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#111827]">
                    {n.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
