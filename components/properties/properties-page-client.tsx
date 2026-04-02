"use client";

import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PropertyCard } from "@/components/properties/property-card";
import { PropertyListRow } from "@/components/properties/property-list-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Property, PropertyStatus } from "@/types/property";

const VIEW_KEY = "proptrackr-properties-view";

type ViewMode = "grid" | "list";

type StatusFilter = "all" | PropertyStatus;

type SortKey = "date" | "price" | "suburb";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "saved", label: "Saved" },
  { value: "inspecting", label: "Inspecting" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "passed", label: "Passed" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date", label: "Date added" },
  { value: "price", label: "Price" },
  { value: "suburb", label: "Suburb" },
];

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function PropertiesPageClient({ properties }: { properties: Property[] }) {
  const [view, setView] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const setViewAndPersist = useCallback((next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setView(readInitialView());
  }, []);

  const filteredSorted = useMemo(() => {
    let rows = [...properties];
    if (statusFilter !== "all") {
      rows = rows.filter((p) => p.status === statusFilter);
    }
    rows.sort((a, b) => {
      if (sortKey === "suburb") {
        return a.suburb.localeCompare(b.suburb, undefined, {
          sensitivity: "base",
        });
      }
      if (sortKey === "price") {
        const pa = a.price ?? Number.POSITIVE_INFINITY;
        const pb = b.price ?? Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [properties, statusFilter, sortKey]);

  const selectClass = cn(
    "h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-sm font-medium text-[#111827] shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30",
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Status
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-semibold",
                  statusFilter === opt.value
                    ? "bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
                )}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#6B7280]">
            <span className="whitespace-nowrap font-medium text-[#374151]">
              Sort
            </span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 rounded-md px-3",
                view === "grid"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280]",
              )}
              onClick={() => setViewAndPersist("grid")}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1.5 rounded-md px-3",
                view === "list"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280]",
              )}
              onClick={() => setViewAndPersist("list")}
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white py-12 text-center text-sm text-[#6B7280]">
          <p className="font-medium text-[#374151]">No properties match</p>
          <p className="mt-1">Try another status filter or add a new listing.</p>
          <Button className="mt-4 bg-[#0D9488] text-white hover:bg-[#0D9488]/90" asChild>
            <Link href="/properties/new">Add property</Link>
          </Button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSorted.map((property) => (
            <li key={property.id}>
              <PropertyCard property={property} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredSorted.map((property) => (
            <li key={property.id}>
              <PropertyListRow property={property} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
