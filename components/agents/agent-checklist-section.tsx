"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { InferSelectModel } from "drizzle-orm";

import {
  createChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/app/actions/agents";
import { agentChecklistItems } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ChecklistRow = InferSelectModel<typeof agentChecklistItems>;

type PropertyOption = {
  id: string;
  title: string;
  address: string;
  suburb: string;
};

function propertyLabel(p: PropertyOption) {
  return `${p.address}, ${p.suburb}`;
}

export function AgentChecklistSection(props: {
  agentId: string;
  checklist: ChecklistRow[];
  propertyOptions: PropertyOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { outstanding, completed } = useMemo(() => {
    const o: ChecklistRow[] = [];
    const c: ChecklistRow[] = [];
    for (const item of props.checklist) {
      if (item.completed) c.push(item);
      else o.push(item);
    }
    return { outstanding: o, completed: c };
  }, [props.checklist]);

  const propById = useMemo(() => {
    const m = new Map<string, PropertyOption>();
    for (const p of props.propertyOptions) m.set(p.id, p);
    return m;
  }, [props.propertyOptions]);

  function onAdd(form: HTMLFormElement) {
    setError(null);
    const formData = new FormData(form);
    formData.set("agentId", props.agentId);
    startTransition(async () => {
      const r = await createChecklistItem(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  function onToggle(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await toggleChecklistItem(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function onDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteChecklistItem(id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function renderItem(item: ChecklistRow) {
    const linked = item.propertyId ? propById.get(item.propertyId) : undefined;
    return (
      <li
        key={item.id}
        className="flex flex-wrap items-start gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => onToggle(item.id)}
            disabled={pending}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[#E5E7EB] text-[#0D9488] focus:ring-[#0D9488]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-[#111827]">{item.content}</span>
            {linked ? (
              <span className="mt-1 block text-xs text-[#6B7280]">
                Property: {propertyLabel(linked)}
              </span>
            ) : null}
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-red-600"
          aria-label="Delete item"
          disabled={pending}
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </li>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">
          Things to do / send this agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(e.currentTarget);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="checklist-content" className="text-sm font-medium text-[#111827]">
                New item
              </label>
              <Input
                id="checklist-content"
                name="content"
                required
                className="mt-1 border-[#E5E7EB]"
                placeholder="e.g. Request contract of sale"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="checklist-property" className="text-sm font-medium text-[#111827]">
                Related property (optional)
              </label>
              <select
                id="checklist-property"
                name="propertyId"
                className="mt-1 flex h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                defaultValue=""
              >
                <option value="">None</option>
                {props.propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="submit"
            disabled={pending}
            size="sm"
            className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
          >
            {pending ? "Adding…" : "Add item"}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#111827]">Outstanding</h3>
          {outstanding.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Nothing pending.</p>
          ) : (
            <ul className="space-y-2">{outstanding.map(renderItem)}</ul>
          )}
        </div>

        <div className="space-y-3 border-t border-[#E5E7EB] pt-6">
          <h3 className="text-sm font-semibold text-[#111827]">Completed</h3>
          {completed.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No completed items yet.</p>
          ) : (
            <ul className="space-y-2 opacity-80">{completed.map(renderItem)}</ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
