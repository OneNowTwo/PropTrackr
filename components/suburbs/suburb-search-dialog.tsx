"use client";

import { Loader2, MapPin, Plus, Search } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";

import { followSuburb } from "@/app/actions/suburbs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SearchResult {
  suburb: string;
  state: string;
  postcode: string;
  display: string;
}

export function SuburbSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}+Australia&format=json&limit=8&addressdetails=1`;
        const res = await fetch(url);
        const json = await res.json();
        const seen = new Set<string>();
        const out: SearchResult[] = [];
        for (const item of json) {
          const addr = item.address;
          if (!addr) continue;
          const suburb =
            addr.suburb || addr.city || addr.town || addr.village || "";
          const state = addr.state || "";
          const postcode = addr.postcode || "";
          if (!suburb || !postcode) continue;
          const stateAbbr = abbreviateState(state);
          const key = `${suburb}|${postcode}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            suburb,
            state: stateAbbr,
            postcode,
            display: `${suburb}, ${stateAbbr} ${postcode}`,
          });
        }
        setResults(out);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleFollow = useCallback(
    (r: SearchResult) => {
      startTransition(async () => {
        await followSuburb(r.suburb, r.state, r.postcode);
        setOpen(false);
        setQuery("");
        setResults([]);
      });
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-[#0D9488] font-semibold text-white shadow-sm hover:bg-[#0D9488]/90">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Follow Suburb
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Follow a Suburb</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search suburb name…"
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-10 pr-4 text-base text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 md:text-sm"
              autoFocus
            />
          </div>
          {searching && (
            <div className="flex items-center gap-2 px-1 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {results.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <li key={`${r.suburb}-${r.postcode}`}>
                  <button
                    type="button"
                    onClick={() => handleFollow(r)}
                    disabled={isPending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#F3F4F6] disabled:opacity-50"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-[#0D9488]" />
                    <span className="flex-1 font-medium text-[#111827]">
                      {r.display}
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="px-1 text-sm text-[#9CA3AF]">
              No suburbs found for &quot;{query}&quot;.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function abbreviateState(full: string): string {
  const map: Record<string, string> = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT",
  };
  return map[full] || full;
}
