"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveSearchPreferences } from "@/app/actions/search-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { searchPreferences } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const CHECK_TYPES = ["House", "Apartment", "Townhouse", "Unit", "Land"] as const;

type PrefsRow = typeof searchPreferences.$inferSelect;

export function SearchPreferencesForm({ initial }: { initial: PrefsRow | null }) {
  const router = useRouter();
  const [suburbs, setSuburbs] = useState<string[]>(initial?.suburbs ?? []);
  const [tagInput, setTagInput] = useState("");
  const [minPrice, setMinPrice] = useState(
    initial?.minPrice != null ? String(initial.minPrice) : "",
  );
  const [maxPrice, setMaxPrice] = useState(
    initial?.maxPrice != null ? String(initial.maxPrice) : "",
  );
  const [types, setTypes] = useState<Set<string>>(
    () =>
      new Set(
        (initial?.propertyTypes ?? []).filter((t) =>
          (CHECK_TYPES as readonly string[]).includes(t),
        ),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addSuburb() {
    const t = tagInput.trim();
    if (!t) return;
    if (suburbs.includes(t)) {
      setTagInput("");
      return;
    }
    if (suburbs.length >= 40) return;
    setSuburbs((s) => [...s, t]);
    setTagInput("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("suburbs", JSON.stringify(suburbs));
    fd.set(
      "propertyTypes",
      JSON.stringify(CHECK_TYPES.filter((t) => types.has(t))),
    );
    startTransition(async () => {
      const r = await saveSearchPreferences(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">Search preferences</CardTitle>
        <p className="text-sm text-[#6B7280]">
          We use these to find new listings on Domain and realestate.com.au (NSW
          searches). You can refresh matches from the dashboard.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium text-[#111827]">Suburbs</label>
            <p className="text-xs text-[#6B7280]">
              Type a suburb and press Enter to add. Remove with ×.
            </p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-2">
              {suburbs.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-sm text-[#111827]"
                >
                  {s}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    aria-label={`Remove ${s}`}
                    onClick={() => setSuburbs((prev) => prev.filter((x) => x !== s))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input
                className="min-w-[8rem] flex-1 border-0 bg-transparent px-2 py-1 text-sm outline-none"
                placeholder="e.g. Randwick"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSuburb();
                  }
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="pref-min" className="text-sm font-medium text-[#111827]">
                Min price (AUD)
              </label>
              <Input
                id="pref-min"
                name="minPrice"
                type="number"
                min={0}
                step={1}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Optional"
                className="border-[#E5E7EB]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="pref-max" className="text-sm font-medium text-[#111827]">
                Max price (AUD)
              </label>
              <Input
                id="pref-max"
                name="maxPrice"
                type="number"
                min={0}
                step={1}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Optional"
                className="border-[#E5E7EB]"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-[#111827]">Property types</span>
            <div className="flex flex-wrap gap-4">
              {CHECK_TYPES.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]"
                >
                  <input
                    type="checkbox"
                    checked={types.has(t)}
                    onChange={() => {
                      setTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(t)) next.delete(t);
                        else next.add(t);
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-[#E5E7EB] text-[#0D9488] focus:ring-[#0D9488]"
                  />
                  {t}
                </label>
              ))}
            </div>
            <p className="text-xs text-[#6B7280]">
              Leave all unchecked to search all five types when discovering listings.
            </p>
          </div>

          <Button
            type="submit"
            disabled={pending}
            className={cn(
              "bg-[#0D9488] font-medium text-white hover:bg-[#0D9488]/90",
            )}
          >
            {pending ? "Saving…" : "Save preferences"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
