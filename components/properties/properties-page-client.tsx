"use client";

import { LayoutGrid, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PropertyCard } from "@/components/properties/property-card";
import { PropertyListRow } from "@/components/properties/property-list-row";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Property } from "@/types/property";

const VIEW_KEY = "proptrackr-properties-view";

type ViewMode = "grid" | "list";

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

  const sorted = useMemo(() => {
    return [...properties].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [properties]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {view === "grid" ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((property) => (
            <li key={property.id}>
              <PropertyCard property={property} showDelete />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((property) => (
            <li key={property.id}>
              <PropertyListRow property={property} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
