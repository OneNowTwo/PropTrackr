"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { saveSearchPreferences } from "@/app/actions/search-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { searchPreferences } from "@/lib/db/schema";
import {
  formatSuburbPreferenceToken,
  parseSuburbPreferenceToken,
} from "@/lib/suburb-preferences";
import { filterNswSuburbSuggestions } from "@/lib/suburbs-au";
import { cn } from "@/lib/utils";

const CHECK_TYPES = ["House", "Apartment", "Townhouse", "Unit", "Land"] as const;

type PrefsRow = typeof searchPreferences.$inferSelect;

type SuburbEntry = { suburb: string; postcode: string; state: string };

function entryKey(e: SuburbEntry): string {
  return formatSuburbPreferenceToken(e);
}

function labelForEntry(e: SuburbEntry): string {
  const t = formatSuburbPreferenceToken(e);
  const p = parseSuburbPreferenceToken(t);
  return p.postcode ? `${p.suburb} ${p.postcode}` : p.suburb;
}

export function SearchPreferencesForm({ initial }: { initial: PrefsRow | null }) {
  const router = useRouter();
  const [entries, setEntries] = useState<SuburbEntry[]>(() =>
    (initial?.suburbs ?? []).map((t) => parseSuburbPreferenceToken(String(t))),
  );
  const [tagInput, setTagInput] = useState("");
  const [listOpen, setListOpen] = useState(false);
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
  const comboboxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => filterNswSuburbSuggestions(tagInput, 8),
    [tagInput],
  );

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!comboboxRef.current?.contains(ev.target as Node)) {
        setListOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function addEntry(entry: SuburbEntry) {
    const k = entryKey(entry);
    if (!entry.suburb.trim()) return;
    setEntries((prev) => {
      if (prev.some((p) => entryKey(p) === k)) return prev;
      if (prev.length >= 40) return prev;
      return [...prev, entry];
    });
    setTagInput("");
    setListOpen(false);
  }

  function pickSuggestion(s: { suburb: string; postcode: string }) {
    addEntry({ suburb: s.suburb, postcode: s.postcode, state: "NSW" });
  }

  function addFreeText() {
    const t = tagInput.trim();
    if (t.length < 2) return;
    addEntry({ suburb: t, postcode: "", state: "NSW" });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const suburbsPayload = entries.map((en) => ({
      suburb: en.suburb.trim(),
      postcode: en.postcode.trim(),
      state: en.state.trim() || "NSW",
    }));
    fd.set("suburbs", JSON.stringify(suburbsPayload));
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

  const showList =
    listOpen && tagInput.trim().length >= 3 && suggestions.length > 0;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">Search preferences</CardTitle>
        <p className="text-sm text-[#6B7280]">
          We use suburbs to discover listings via agency sites (see Coverage
          below). You can refresh matches from the dashboard.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          <input
            type="hidden"
            name="suburbs"
            value={JSON.stringify(
              entries.map((en) => ({
                suburb: en.suburb.trim(),
                postcode: en.postcode.trim(),
                state: en.state.trim() || "NSW",
              })),
            )}
            readOnly
            onChange={() => {}}
            aria-hidden
          />

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium text-[#111827]">Suburbs</label>
            <p className="text-xs text-[#6B7280]">
              Type at least 3 characters for NSW suburb suggestions (with
              postcode), or press Enter to add a custom suburb.
            </p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-2">
              {entries.map((en) => (
                <span
                  key={entryKey(en)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-sm text-[#111827]"
                >
                  {labelForEntry(en)}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    aria-label={`Remove ${labelForEntry(en)}`}
                    onClick={() =>
                      setEntries((prev) =>
                        prev.filter((p) => entryKey(p) !== entryKey(en)),
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <div ref={comboboxRef} className="relative min-w-[12rem] flex-1">
                <Input
                  className="border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0"
                  placeholder="e.g. Mosman"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setListOpen(true);
                  }}
                  onFocus={() => setListOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (showList) {
                        pickSuggestion(suggestions[0]!);
                      } else {
                        addFreeText();
                      }
                    }
                  }}
                />
                {showList ? (
                  <ul
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#E5E7EB] bg-white py-1 text-sm shadow-md"
                    role="listbox"
                  >
                    {suggestions.map((s) => (
                      <li key={`${s.suburb}-${s.postcode}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-[#111827] hover:bg-[#F3F4F6]"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => pickSuggestion(s)}
                        >
                          {s.suburb} {s.postcode}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
