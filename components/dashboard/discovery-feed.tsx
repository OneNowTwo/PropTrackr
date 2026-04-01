"use client";

import { Bath, BedDouble, Car, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  discoverNewListings,
  markMaybe,
  markNotInterested,
  saveDiscoveredProperty,
} from "@/app/actions/discover-listings";
import { toast } from "@/hooks/use-toast";
import type { DiscoveredPropertyRow } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatAud } from "@/lib/utils";

function safeListingHref(url: string | null | undefined): string | null {
  const s = url?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function firstBulletLines(notes: string, max = 2): string[] {
  const lines = notes
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter(
    (l) => /^[•*]/.test(l) || /^-\s/.test(l) || l.startsWith("•"),
  );
  return bullets.slice(0, max);
}

type Tab = "new" | "maybe";

type Props = {
  /** True once a search_preferences row exists (even with zero suburbs). */
  hasSavedPreferences: boolean;
  pending: DiscoveredPropertyRow[];
  maybe: DiscoveredPropertyRow[];
};

export function DiscoveryFeed({
  hasSavedPreferences,
  pending,
  maybe,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("new");
  const [discError, setDiscError] = useState<string | null>(null);
  const [pendingDiscover, startDiscover] = useTransition();
  const [pendingAction, startAction] = useTransition();

  const rows = tab === "new" ? pending : maybe;
  const hasRows = rows.length > 0;

  function refresh() {
    router.refresh();
  }

  function onRefreshListings() {
    setDiscError(null);
    startDiscover(async () => {
      const r = await discoverNewListings();
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Discovery failed",
          description: "Something went wrong, try again",
        });
        setDiscError(r.error);
        return;
      }
      if (r.added > 0) {
        toast({
          title: "Discovery",
          description: `Found ${r.added} new listing${r.added === 1 ? "" : "s"}`,
        });
      } else {
        toast({
          title: "Discovery",
          description: "No new listings found",
        });
      }
      router.refresh();
      queueMicrotask(() => {
        router.refresh();
      });
    });
  }

  function onSave(id: string) {
    setDiscError(null);
    startAction(async () => {
      const r = await saveDiscoveredProperty(id);
      if (!r.ok) {
        setDiscError(r.error);
        return;
      }
      router.push(`/properties/${r.propertyId}`);
    });
  }

  function onMaybe(id: string) {
    setDiscError(null);
    startAction(async () => {
      const r = await markMaybe(id);
      if (!r.ok) {
        setDiscError(r.error);
        return;
      }
      refresh();
    });
  }

  function onDismiss(id: string) {
    setDiscError(null);
    startAction(async () => {
      const r = await markNotInterested(id);
      if (!r.ok) {
        setDiscError(r.error);
        return;
      }
      refresh();
    });
  }

  if (!hasSavedPreferences) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
          New in your area
        </h2>
        <p className="text-sm text-[#6B7280]">
          <Link
            href="/account"
            className="font-medium text-[#0D9488] underline-offset-4 hover:underline"
          >
            Set your search preferences
          </Link>{" "}
          to see new listings in your area →
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
            New in your area
          </h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {tab === "new" ? (
              <>
                {pending.length} new listing{pending.length === 1 ? "" : "s"} in
                your area
                {maybe.length > 0
                  ? ` · ${maybe.length} in Maybe`
                  : null}
              </>
            ) : (
              <>
                {maybe.length} listing{maybe.length === 1 ? "" : "s"} marked
                maybe
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pendingDiscover || pendingAction}
          onClick={onRefreshListings}
          className="shrink-0 gap-2 border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]"
        >
          <RefreshCw
            className={cn("h-4 w-4", pendingDiscover && "animate-spin")}
          />
          Refresh listings
        </Button>
      </div>

      {discError ? (
        <p className="text-sm text-red-600" role="alert">
          {discError}
        </p>
      ) : null}

      <div className="flex gap-2 rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setTab("new")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "new"
              ? "bg-[#0D9488] text-white"
              : "text-[#6B7280] hover:bg-[#F9FAFB]",
          )}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => setTab("maybe")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "maybe"
              ? "bg-[#0D9488] text-white"
              : "text-[#6B7280] hover:bg-[#F9FAFB]",
          )}
        >
          Maybe
          {maybe.length > 0 ? (
            <span className="ml-1 tabular-nums opacity-90">({maybe.length})</span>
          ) : null}
        </button>
      </div>

      {!hasRows ? (
        <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="py-8 text-center text-sm text-[#6B7280]">
            {tab === "new"
              ? "Run a refresh to scan for new listings, or check back later."
              : "No properties marked maybe yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {rows.map((row) => (
            <DiscoveryCard
              key={row.id}
              row={row}
              showMaybeBadge={tab === "maybe"}
              disabled={pendingAction}
              onSave={() => onSave(row.id)}
              onMaybe={() => onMaybe(row.id)}
              onDismiss={() => onDismiss(row.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DiscoveryCard({
  row,
  showMaybeBadge,
  disabled,
  onSave,
  onMaybe,
  onDismiss,
}: {
  row: DiscoveredPropertyRow;
  showMaybeBadge: boolean;
  disabled: boolean;
  onSave: () => void;
  onMaybe: () => void;
  onDismiss: () => void;
}) {
  const img = row.imageUrl?.trim();
  const listingHref = safeListingHref(row.listingUrl);
  const bullets = firstBulletLines(row.notes ?? "");

  return (
    <Card
      className={cn(
        "w-[280px] shrink-0 overflow-hidden border-[#E5E7EB] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-[#F3F4F6]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#9CA3AF]">
            No image
          </div>
        )}
        {showMaybeBadge ? (
          <Badge className="absolute right-2 top-2 bg-[#6B7280] text-white">
            Maybe
          </Badge>
        ) : null}
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#111827]">
            {row.address}
          </p>
          <p className="text-xs text-[#6B7280]">{row.suburb}</p>
          <p className="mt-1 text-base font-semibold text-[#0D9488]">
            {formatAud(row.price)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[#6B7280]">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-[#0D9488]" />
            {row.bedrooms ?? "—"} bed
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5 text-[#0D9488]" />
            {row.bathrooms ?? "—"} bath
          </span>
          <span className="inline-flex items-center gap-1">
            <Car className="h-3.5 w-3.5 text-[#0D9488]" />
            {row.parkingSpaces ?? "—"} car
          </span>
        </div>
        {bullets.length > 0 ? (
          <ul className="space-y-1 text-xs leading-relaxed text-[#4B5563]">
            {bullets.map((b, i) => (
              <li key={i} className="line-clamp-2">
                {b.replace(/^[-•*]\s*/, "")}
              </li>
            ))}
          </ul>
        ) : null}
        {row.agentName?.trim() ? (
          <p className="text-xs text-[#6B7280]">
            <span className="font-medium text-[#111827]">Agent:</span>{" "}
            {row.agentName.trim()}
            {row.agencyName?.trim() ? ` · ${row.agencyName.trim()}` : null}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-3">
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            className="w-full bg-[#0D9488] font-medium text-white hover:bg-[#0D9488]/90"
            onClick={onSave}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="w-full border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]"
            onClick={onMaybe}
          >
            Maybe
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="w-full border border-red-200 bg-white text-red-700 hover:bg-red-50"
            onClick={onDismiss}
          >
            Not interested
          </Button>
          {listingHref ? (
            <Link
              href={listingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs font-medium text-[#0D9488] hover:underline"
            >
              View listing
            </Link>
          ) : (
            <span className="text-center text-xs text-[#9CA3AF]">
              Listing link unavailable
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
