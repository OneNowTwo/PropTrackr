"use client";

import {
  ClipboardList,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  generateInspectionChecklist,
  resetInspectionChecklistChecks,
  setChecklistCategoryChecked,
  updateChecklistItem,
} from "@/app/actions/inspection-checklist";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import type { InspectionChecklistItem } from "@/lib/inspection-checklist/types";
import { cn } from "@/lib/utils";

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

function groupByCategory(items: InspectionChecklistItem[]) {
  const map = new Map<string, InspectionChecklistItem[]>();
  for (const it of items) {
    const c = it.category?.trim() || "General";
    const list = map.get(c) ?? [];
    list.push(it);
    map.set(c, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

type Props = {
  propertyId: string;
  initialChecklist: {
    rowId: string;
    items: InspectionChecklistItem[];
    generatedAt: string;
  } | null;
};

export function InspectionChecklist({ propertyId, initialChecklist }: Props) {
  const isMdUp = useIsMdUp();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const grouped = useMemo(
    () => (checklist ? groupByCategory(checklist.items) : []),
    [checklist],
  );

  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const [cat] of grouped) {
      next[cat] = isMdUp;
    }
    setOpenCats(next);
  }, [grouped, isMdUp]);

  const total = checklist?.items.length ?? 0;
  const checkedCount =
    checklist?.items.filter((i) => i.checked).length ?? 0;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await generateInspectionChecklist(propertyId);
      if (res.ok) setChecklist(res.checklist);
    } finally {
      setGenerating(false);
    }
  }, [propertyId]);

  const onToggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
      if (!checklist) return;
      setBusyId(itemId);
      const prev = checklist.items;
      setChecklist({
        ...checklist,
        items: prev.map((i) => (i.id === itemId ? { ...i, checked } : i)),
      });
      const res = await updateChecklistItem(propertyId, itemId, checked);
      if (!res.ok) {
        setChecklist({
          ...checklist,
          items: prev,
        });
      }
      setBusyId(null);
    },
    [checklist, propertyId],
  );

  const onCategoryAll = useCallback(
    async (category: string, checked: boolean) => {
      if (!checklist) return;
      setCategoryBusy(category);
      const prev = checklist.items;
      setChecklist({
        ...checklist,
        items: checklist.items.map((i) =>
          i.category === category ? { ...i, checked } : i,
        ),
      });
      const res = await setChecklistCategoryChecked(
        propertyId,
        category,
        checked,
      );
      if (!res.ok) {
        setChecklist({ ...checklist, items: prev });
      }
      setCategoryBusy(null);
    },
    [checklist, propertyId],
  );

  const onReset = useCallback(async () => {
    if (!checklist) return;
    setResetting(true);
    setChecklist({
      ...checklist,
      items: checklist.items.map((i) => ({ ...i, checked: false })),
    });
    await resetInspectionChecklistChecks(propertyId);
    setResetting(false);
  }, [checklist, propertyId]);

  const onShare = useCallback(() => {
    if (!checklist) return;
    const lines: string[] = ["Inspection checklist", ""];
    for (const [cat, items] of grouped) {
      lines.push(`## ${cat}`);
      for (const it of items) {
        const box = it.checked ? "[x]" : "[ ]";
        lines.push(`${box} ${it.text}`);
        if (it.hint) lines.push(`   (${it.hint})`);
      }
      lines.push("");
    }
    const text = lines.join("\n");
    void navigator.clipboard.writeText(text).then(() => {
      setShareMsg("Copied to clipboard");
      window.setTimeout(() => setShareMsg(null), 2500);
    });
  }, [checklist, grouped]);

  return (
    <section id="inspection-checklist" className="scroll-mt-24">
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-[#111827]">
                Inspection Checklist
              </h3>
              {checklist ? (
                <p className="text-xs text-[#6B7280]">
                  {checkedCount} of {total} checked · {pct}% complete
                </p>
              ) : (
                <p className="text-xs text-[#6B7280]">
                  Get a tailored checklist for this property type and price point
                </p>
              )}
              </div>
              <HelpTooltip
                title="AI Inspection Checklist"
                content="A tailored checklist generated by AI based on this specific property type, age, and price point. Check items off as you inspect."
              />
            </div>
          </div>
          {checklist ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#6B7280] hover:text-[#111827]"
              disabled={generating}
              onClick={() => void onGenerate()}
            >
              {generating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Regenerate
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {!checklist ? (
            <div className="space-y-3">
              <Button
                type="button"
                className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                disabled={generating}
                onClick={() => void onGenerate()}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating your checklist…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate AI inspection checklist
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                <div
                  className="h-full rounded-full bg-[#0D9488] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="space-y-2">
                {grouped.map(([category, items]) => {
                  const catChecked = items.filter((i) => i.checked).length;
                  const allChecked = catChecked === items.length;
                  const open = openCats[category] ?? false;
                  return (
                    <div
                      key={category}
                      className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCats((s) => ({
                            ...s,
                            [category]: !open,
                          }))
                        }
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left md:cursor-default"
                        aria-expanded={open}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#111827]">
                            {category}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {catChecked}/{items.length} done
                          </p>
                        </div>
                        <span className="text-[#9CA3AF] md:hidden">
                          {open ? "−" : "+"}
                        </span>
                      </button>
                      <div
                        className={cn(
                          "border-t border-[#E5E7EB] px-3 py-2",
                          !open && "hidden md:block",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={categoryBusy === category}
                            onClick={() =>
                              void onCategoryAll(category, !allChecked)
                            }
                            className="text-xs font-medium text-[#0D9488] hover:underline disabled:opacity-50"
                          >
                            {allChecked ? "Uncheck all in category" : "Check all in category"}
                          </button>
                        </div>
                        <ul className="space-y-3">
                          {items.map((it) => (
                            <li key={it.id} className="flex gap-3">
                              <label className="flex cursor-pointer gap-3">
                                <input
                                  type="checkbox"
                                  checked={it.checked}
                                  disabled={busyId === it.id}
                                  onChange={(e) =>
                                    void onToggleItem(it.id, e.target.checked)
                                  }
                                  className="mt-1 h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#0D9488] focus:ring-[#0D9488]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "text-sm text-[#111827]",
                                      it.checked &&
                                        "text-[#9CA3AF] line-through",
                                    )}
                                  >
                                    {it.text}
                                  </span>
                                  {it.priority === "high" ? (
                                    <span
                                      className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-red-50 px-1 text-[10px] font-bold text-red-600"
                                      title="High priority"
                                    >
                                      !
                                    </span>
                                  ) : null}
                                  {it.hint ? (
                                    <span
                                      className="mt-1 block text-xs italic text-[#9CA3AF]"
                                      title={it.hint}
                                    >
                                      {it.hint}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E5E7EB]"
                  onClick={() => void onShare()}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Share checklist
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#E5E7EB] text-[#6B7280]"
                  disabled={resetting}
                  onClick={() => void onReset()}
                >
                  {resetting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  Reset all
                </Button>
                {shareMsg ? (
                  <span className="self-center text-xs text-[#0D9488]">
                    {shareMsg}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
