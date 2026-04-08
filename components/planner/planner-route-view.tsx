"use client";

import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlannerInspectionRow } from "@/lib/db/queries";
import {
  estimateDriveMinutesFromStraightLineKm,
  googleMapsDirUrl,
  haversineKm,
  inspectionRowsToSeeds,
  orderStopsTimeThenNearest,
  propertyByIdMap,
  buildFullAddress,
} from "@/lib/planner/route-plan";
import {
  inspectionCalendarYmd,
  inspectionTimestampMs,
  ymdUtc,
} from "@/lib/planner/inspection-dates";
import type { Property } from "@/types/property";
import { cn } from "@/lib/utils";

type Props = {
  inspections: PlannerInspectionRow[];
  properties: Property[];
  weekDays: Date[];
  weekRangeLabel: string;
};

function loadMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as Window & { google?: { maps?: unknown } };
  if (w.google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-proptrackr-maps="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.async = true;
    s.defer = true;
    s.dataset.proptrackrMaps = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Maps script failed"));
    document.head.appendChild(s);
  });
}

function formatTimeLabel(time: string) {
  const [h, m] = time.split(":");
  const hour = Number.parseInt(h ?? "0", 10);
  const min = m ?? "00";
  if (!Number.isFinite(hour)) return time;
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

export function PlannerRouteView({
  inspections,
  properties,
  weekDays,
  weekRangeLabel,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const ymdSet = useMemo(
    () => new Set(weekDays.map((d) => ymdUtc(d))),
    [weekDays],
  );

  const weekUpcoming = useMemo(() => {
    const now = Date.now();
    return inspections
      .filter((r) => {
        const key = inspectionCalendarYmd(r.inspectionDate);
        if (!ymdSet.has(key)) return false;
        return inspectionTimestampMs(r) >= now;
      })
      .sort((a, b) => inspectionTimestampMs(a) - inspectionTimestampMs(b));
  }, [inspections, ymdSet]);

  const propMap = useMemo(() => propertyByIdMap(properties), [properties]);

  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<
    ReturnType<typeof orderStopsTimeThenNearest>
  >([]);

  const geocodeAndBuild = useCallback(async () => {
    if (!apiKey || weekUpcoming.length === 0) {
      setOrderedStops([]);
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      await loadMapsScript(apiKey);
      const geocoder = new google.maps.Geocoder();
      const coords = new Map<string, { lat: number; lng: number }>();
      const uniqueProps = new Map<string, Property>();
      for (const row of weekUpcoming) {
        const p = propMap.get(row.propertyId);
        if (p) uniqueProps.set(p.id, p);
      }
      await Promise.all(
        Array.from(uniqueProps.values()).map(
          (p) =>
            new Promise<void>((resolve) => {
              const addr = buildFullAddress(p);
              geocoder.geocode({ address: addr }, (results, status) => {
                if (status === "OK" && results?.[0]?.geometry?.location) {
                  const loc = results[0].geometry.location;
                  coords.set(p.id, { lat: loc.lat(), lng: loc.lng() });
                }
                resolve();
              });
            }),
        ),
      );
      const seeds = inspectionRowsToSeeds(weekUpcoming, propMap, coords);
      if (seeds.length === 0) {
        setLoadError(
          "Could not locate properties on the map. Check addresses in your listings.",
        );
        setOrderedStops([]);
        setLoadState("error");
        return;
      }
      const timeSorted = [...seeds].sort(
        (a, b) => a.inspectionTimestamp - b.inspectionTimestamp,
      );
      const optimized = orderStopsTimeThenNearest(timeSorted);
      setOrderedStops(optimized);
      setLoadState("ready");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not build route.");
      setLoadState("error");
    }
  }, [apiKey, weekUpcoming, propMap]);

  useEffect(() => {
    void geocodeAndBuild();
  }, [geocodeAndBuild]);

  useEffect(() => {
    if (!apiKey || loadState !== "ready" || !mapEl.current || orderedStops.length === 0)
      return;
    const center = orderedStops[0]!;
    const map = new google.maps.Map(mapEl.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    mapRef.current = map;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    orderedStops.forEach((stop, i) => {
      const pos = { lat: stop.lat, lng: stop.lng };
      bounds.extend(pos);
      const marker = new google.maps.Marker({
        position: pos,
        map,
        label: { text: String(i + 1), color: "#ffffff", fontWeight: "bold" },
      });
      markersRef.current.push(marker);
    });
    map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [apiKey, loadState, orderedStops]);

  const mapsUrl = useMemo(
    () => googleMapsDirUrl(orderedStops.map((s) => s.addressLine)),
    [orderedStops],
  );

  if (!apiKey) {
    return (
      <Card className="border border-[#0D9488]/20 bg-[#0D9488]/[0.06] shadow-sm">
        <CardContent className="flex gap-3 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#0D9488] shadow-sm ring-1 ring-[#0D9488]/15">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-[#111827]">Route planning</p>
            <p className="text-sm leading-relaxed text-[#4B5563]">
              Add a Google Maps API key to enable route planning. Set{" "}
              <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs text-[#374151] ring-1 ring-[#E5E7EB]">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              </span>{" "}
              in your environment variables.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base text-[#111827]">Route</CardTitle>
          <p className="mt-1 text-xs text-[#6B7280]">{weekRangeLabel}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-[#E5E7EB] gap-1.5"
          disabled={orderedStops.length === 0}
          asChild
        >
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open in Google Maps
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {weekUpcoming.length === 0 ? (
          <p className="text-sm text-[#6B7280]">
            No upcoming inspections this week.
          </p>
        ) : loadState === "loading" || loadState === "idle" ? (
          <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
            Loading map and addresses…
          </div>
        ) : loadError ? (
          <div
            className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm leading-relaxed text-[#4B5563]"
            role="status"
          >
            {loadError}
          </div>
        ) : (
          <>
            <div
              ref={mapEl}
              className={cn(
                "h-[min(420px,55vh)] w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F3F4F6]",
              )}
            />
            <ol className="space-y-3">
              {orderedStops.map((stop, i) => {
                const next = orderedStops[i + 1];
                let distKm: number | null = null;
                let legMin: number | null = null;
                if (next) {
                  distKm = haversineKm(
                    stop.lat,
                    stop.lng,
                    next.lat,
                    next.lng,
                  );
                  legMin = estimateDriveMinutesFromStraightLineKm(distKm);
                }
                return (
                  <li
                    key={`${stop.inspectionId}-${i}`}
                    className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#111827]">
                          {stop.addressLine}
                        </p>
                        <p className="text-sm text-[#0D9488]">
                          Inspection {formatTimeLabel(stop.inspectionTime)}
                        </p>
                      </div>
                    </div>
                    {next && distKm != null && legMin != null ? (
                      <p className="mt-2 border-t border-[#E5E7EB] pt-2 text-xs text-[#6B7280]">
                        To next: ~{distKm.toFixed(1)} km straight-line · ~{legMin}{" "}
                        min drive (est.)
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}
