"use client";

import {
  Car,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
} from "lucide-react";
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
  buildFullAddress,
  estimateDriveMinutesFromStraightLineKm,
  googleMapsDirUrl,
  haversineKm,
  inspectionRowsToSeeds,
  orderStopsTimeThenNearest,
  propertyByIdMap,
} from "@/lib/planner/route-plan";
import {
  inspectionCalendarYmd,
  inspectionTimestampMs,
  nextSaturdayYmdUtc,
} from "@/lib/planner/inspection-dates";
import type { Property } from "@/types/property";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  inspections: PlannerInspectionRow[];
  properties: Property[];
};

type RouteLeg = {
  durationMinutes: number;
  distanceKm: number;
  durationText: string;
  distanceText: string;
};

type RouteStop = {
  inspectionId: string;
  propertyId: string;
  addressLine: string;
  inspectionTime: string;
  inspectionMinutes: number;
  durationMinutes: number;
  lat: number;
  lng: number;
  arrivalMinutes: number;
  legFromPrev: RouteLeg | null;
};

type RouteData = {
  stops: RouteStop[];
  totalDriveMinutes: number;
  departureTime: string;
  dateLabel: string;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: RouteData }
  | { status: "error"; message: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeLabel(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTimeLabel(time: string) {
  return minutesToTimeLabel(timeToMinutes(time));
}

function formatDateLabel(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y!, mo! - 1, d!));
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function findTargetDate(inspections: PlannerInspectionRow[]): {
  ymd: string;
  label: string;
} {
  const now = new Date();
  const nowMs = now.getTime();
  const satYmd = nextSaturdayYmdUtc(now);

  const upcoming = inspections
    .filter((r) => inspectionTimestampMs(r) >= nowMs)
    .sort((a, b) => inspectionTimestampMs(a) - inspectionTimestampMs(b));

  const satCount = upcoming.filter(
    (r) => inspectionCalendarYmd(r.inspectionDate) === satYmd,
  ).length;
  if (satCount > 0) return { ymd: satYmd, label: formatDateLabel(satYmd) };

  const byDate: Record<string, number> = {};
  const dateOrder: string[] = [];
  for (const r of upcoming) {
    const key = inspectionCalendarYmd(r.inspectionDate);
    if (!(key in byDate)) dateOrder.push(key);
    byDate[key] = (byDate[key] ?? 0) + 1;
  }
  for (const ymd of dateOrder) {
    if ((byDate[ymd] ?? 0) >= 2) return { ymd, label: formatDateLabel(ymd) };
  }

  if (upcoming.length > 0) {
    const ymd = inspectionCalendarYmd(upcoming[0]!.inspectionDate);
    return { ymd, label: formatDateLabel(ymd) };
  }

  return { ymd: satYmd, label: formatDateLabel(satYmd) };
}

function arrivalColor(
  arrivalMinutes: number,
  inspectionMinutes: number,
  isFirst: boolean,
): "green" | "amber" | "red" {
  if (isFirst) return "green";
  const diff = inspectionMinutes - arrivalMinutes;
  if (diff >= 10) return "green";
  if (diff >= 0) return "amber";
  return "red";
}

const COLOR_CLASSES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
} as const;

const DOT_CLASSES = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
} as const;

/* ------------------------------------------------------------------ */
/*  Maps script loader                                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlannerRouteView({ inspections, properties }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsRef = useRef<google.maps.DirectionsResult | null>(null);

  const propMap = useMemo(() => propertyByIdMap(properties), [properties]);

  const target = useMemo(() => findTargetDate(inspections), [inspections]);

  const dayInspections = useMemo(
    () =>
      inspections
        .filter(
          (r) => inspectionCalendarYmd(r.inspectionDate) === target.ymd,
        )
        .sort(
          (a, b) => inspectionTimestampMs(a) - inspectionTimestampMs(b),
        ),
    [inspections, target.ymd],
  );

  const [state, setState] = useState<State>({ status: "idle" });

  /* ---- Build route (geocode → order → directions → arrivals) ---- */

  const buildRoute = useCallback(async () => {
    if (!apiKey) {
      setState({ status: "idle" });
      return;
    }
    if (dayInspections.length === 0) {
      setState({
        status: "ready",
        data: {
          stops: [],
          totalDriveMinutes: 0,
          departureTime: "",
          dateLabel: target.label,
        },
      });
      return;
    }

    setState({ status: "loading" });

    try {
      await loadMapsScript(apiKey);
      const geocoder = new google.maps.Geocoder();
      const coords = new Map<string, { lat: number; lng: number }>();
      const uniqueProps = new Map<string, Property>();
      for (const row of dayInspections) {
        const p = propMap.get(row.propertyId);
        if (p) uniqueProps.set(p.id, p);
      }

      for (const p of Array.from(uniqueProps.values())) {
        const addr = buildFullAddress(p);
        console.log("[planner] geocoding:", addr);
        try {
          const result = await new Promise<google.maps.GeocoderResult | null>(
            (resolve) => {
              geocoder.geocode({ address: addr }, (results, status) => {
                console.log("[planner] geocode", status, "for:", addr);
                if (
                  status === "OK" &&
                  results?.[0]?.geometry?.location
                ) {
                  const loc = results[0].geometry.location;
                  console.log(
                    "[planner] →",
                    loc.lat().toFixed(5),
                    loc.lng().toFixed(5),
                  );
                  resolve(results[0]);
                } else {
                  console.warn("[planner] geocode failed for:", addr, status);
                  resolve(null);
                }
              });
            },
          );
          if (result) {
            const loc = result.geometry.location;
            coords.set(p.id, { lat: loc.lat(), lng: loc.lng() });
          }
        } catch (err) {
          console.error("[planner] geocode error for:", addr, err);
        }
      }

      const seeds = inspectionRowsToSeeds(dayInspections, propMap, coords);
      if (seeds.length === 0) {
        setState({
          status: "error",
          message:
            "Could not locate properties on the map. Check addresses in your listings.",
        });
        return;
      }

      const ordered = orderStopsTimeThenNearest(seeds);

      /* --- Directions API --- */
      let legs: RouteLeg[] = [];
      directionsRef.current = null;

      if (ordered.length >= 2) {
        try {
          const svc = new google.maps.DirectionsService();
          const origin = { lat: ordered[0]!.lat, lng: ordered[0]!.lng };
          const dest = {
            lat: ordered[ordered.length - 1]!.lat,
            lng: ordered[ordered.length - 1]!.lng,
          };
          const waypoints =
            ordered.length > 2
              ? ordered.slice(1, -1).map((s) => ({
                  location: new google.maps.LatLng(s.lat, s.lng),
                  stopover: true,
                }))
              : [];

          const dr = await new Promise<google.maps.DirectionsResult | null>(
            (resolve) => {
              svc.route(
                {
                  origin,
                  destination: dest,
                  waypoints,
                  travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                  if (status === "OK" && result) {
                    resolve(result);
                  } else {
                    console.warn("[planner] directions failed:", status);
                    resolve(null);
                  }
                },
              );
            },
          );

          if (dr?.routes?.[0]?.legs) {
            directionsRef.current = dr;
            legs = dr.routes[0].legs.map((leg) => ({
              durationMinutes: Math.ceil(
                (leg.duration?.value ?? 0) / 60,
              ),
              distanceKm:
                Math.round(
                  ((leg.distance?.value ?? 0) / 1000) * 10,
                ) / 10,
              durationText: leg.duration?.text ?? "",
              distanceText: leg.distance?.text ?? "",
            }));
          }
        } catch (err) {
          console.error("[planner] directions error:", err);
        }
      }

      if (legs.length === 0 && ordered.length >= 2) {
        for (let i = 0; i < ordered.length - 1; i++) {
          const a = ordered[i]!;
          const b = ordered[i + 1]!;
          const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
          const min = estimateDriveMinutesFromStraightLineKm(km);
          legs.push({
            durationMinutes: min,
            distanceKm: Math.round(km * 10) / 10,
            durationText: `~${min} min`,
            distanceText: `${km.toFixed(1)} km`,
          });
        }
      }

      /* --- Arrival times --- */
      const stops: RouteStop[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const s = ordered[i]!;
        const inspMin = timeToMinutes(s.inspectionTime);
        const row = dayInspections.find((r) => r.id === s.inspectionId);
        const dur = row?.durationMinutes ?? 30;

        let arrivalMinutes: number;
        let legFromPrev: RouteLeg | null = null;

        if (i === 0) {
          arrivalMinutes = inspMin;
        } else {
          const prev = stops[i - 1]!;
          const prevDepart =
            Math.max(prev.arrivalMinutes, prev.inspectionMinutes) +
            prev.durationMinutes;
          legFromPrev = legs[i - 1] ?? null;
          arrivalMinutes = prevDepart + (legFromPrev?.durationMinutes ?? 0);
        }

        stops.push({
          inspectionId: s.inspectionId,
          propertyId: s.propertyId,
          addressLine: s.addressLine,
          inspectionTime: s.inspectionTime,
          inspectionMinutes: inspMin,
          durationMinutes: dur,
          lat: s.lat,
          lng: s.lng,
          arrivalMinutes,
          legFromPrev,
        });
      }

      const totalDriveMinutes = legs.reduce(
        (sum, l) => sum + l.durationMinutes,
        0,
      );
      const departureTime =
        stops.length > 0
          ? minutesToTimeLabel(
              Math.max(0, stops[0]!.inspectionMinutes - 30),
            )
          : "";

      setState({
        status: "ready",
        data: { stops, totalDriveMinutes, departureTime, dateLabel: target.label },
      });
    } catch (e) {
      setState({
        status: "error",
        message:
          e instanceof Error ? e.message : "Could not build route.",
      });
    }
  }, [apiKey, dayInspections, propMap, target.label]);

  useEffect(() => {
    void buildRoute();
  }, [buildRoute]);

  /* ---- Render map ---- */

  useEffect(() => {
    if (state.status !== "ready" || !mapEl.current || !apiKey) return;
    const { stops } = state.data;
    if (stops.length === 0) return;

    const map = new google.maps.Map(mapEl.current, {
      center: { lat: stops[0]!.lat, lng: stops[0]!.lng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    mapRef.current = map;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    stops.forEach((stop, i) => {
      const pos = { lat: stop.lat, lng: stop.lng };
      bounds.extend(pos);
      const marker = new google.maps.Marker({
        position: pos,
        map,
        label: {
          text: String(i + 1),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#0D9488",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 16,
          labelOrigin: new google.maps.Point(0, 0),
        },
        title: `${i + 1}. ${stop.addressLine}\nInspection: ${formatTimeLabel(stop.inspectionTime)}\nEst. arrival: ${minutesToTimeLabel(stop.arrivalMinutes)}`,
      });
      markersRef.current.push(marker);
    });

    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }
    if (directionsRef.current) {
      rendererRef.current = new google.maps.DirectionsRenderer({
        map,
        directions: directionsRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#0D9488",
          strokeWeight: 4,
          strokeOpacity: 0.7,
        },
      });
    } else if (stops.length >= 2) {
      new google.maps.Polyline({
        path: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
        strokeColor: "#0D9488",
        strokeWeight: 3,
        strokeOpacity: 0.6,
        map,
      });
    }

    map.fitBounds(bounds, { top: 32, right: 32, bottom: 32, left: 32 });
  }, [state, apiKey]);

  /* ---- Computed for render ---- */

  const mapsUrl = useMemo(
    () =>
      state.status === "ready"
        ? googleMapsDirUrl(state.data.stops.map((s) => s.addressLine))
        : "#",
    [state],
  );

  /* ---- No API key ---- */

  if (!apiKey) {
    return (
      <Card className="border border-[#0D9488]/20 bg-[#0D9488]/[0.06] shadow-sm">
        <CardContent className="flex gap-3 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#0D9488] shadow-sm ring-1 ring-[#0D9488]/15">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-[#111827]">
              Route planning
            </p>
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

  /* ---- Main render ---- */

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base text-[#111827]">
            Route for{" "}
            {state.status === "ready" ? state.data.dateLabel : "…"}
          </CardTitle>
          <p className="mt-1 text-xs text-[#6B7280]">
            {dayInspections.length} inspection
            {dayInspections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 border-[#E5E7EB]"
          disabled={state.status !== "ready" || state.data.stops.length === 0}
          asChild
        >
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open in Google Maps
          </a>
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {dayInspections.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6B7280]">
            No inspections scheduled. Add inspections from the calendar or
            a property page.
          </p>
        ) : state.status === "loading" || state.status === "idle" ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6B7280]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
            Loading route…
          </div>
        ) : state.status === "error" ? (
          <div
            className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm leading-relaxed text-[#4B5563]"
            role="status"
          >
            {state.message}
          </div>
        ) : (
          <>
            {/* --- Summary card --- */}
            {state.data.stops.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[#6B7280]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">
                      Stops
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
                    {state.data.stops.length}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[#6B7280]">
                    <Car className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">
                      Drive
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
                    {state.data.totalDriveMinutes} min
                  </p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[#6B7280]">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">
                      Depart by
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">
                    {state.data.departureTime}
                  </p>
                </div>
              </div>
            )}

            {/* --- Map --- */}
            <div
              ref={mapEl}
              className="h-[min(420px,55vh)] w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F3F4F6]"
            />

            {/* --- Timeline --- */}
            <div className="space-y-0">
              {state.data.stops.map((stop, i) => {
                const color = arrivalColor(
                  stop.arrivalMinutes,
                  stop.inspectionMinutes,
                  i === 0,
                );
                return (
                  <div key={`${stop.inspectionId}-${i}`}>
                    {/* Drive segment between stops */}
                    {stop.legFromPrev && (
                      <div className="flex items-center gap-3 py-2 pl-3">
                        <div className="flex w-7 justify-center">
                          <div className="h-6 w-0.5 bg-[#E5E7EB]" />
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          <Car className="mr-1 inline h-3 w-3" />
                          {stop.legFromPrev.durationText ||
                            `~${stop.legFromPrev.durationMinutes} min`}{" "}
                          · {stop.legFromPrev.distanceText}
                        </p>
                      </div>
                    )}
                    {/* Stop card */}
                    <div
                      className={cn(
                        "rounded-lg border p-3",
                        COLOR_CLASSES[color],
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                            DOT_CLASSES[color],
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#111827]">
                            {stop.addressLine}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <span>
                              Inspection{" "}
                              <strong>
                                {formatTimeLabel(stop.inspectionTime)}
                              </strong>
                            </span>
                            {i > 0 && (
                              <span>
                                Est. arrival{" "}
                                <strong>
                                  {minutesToTimeLabel(stop.arrivalMinutes)}
                                </strong>
                              </span>
                            )}
                            <span className="text-[#6B7280]">
                              {stop.durationMinutes} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
