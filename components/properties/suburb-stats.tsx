"use client";

import {
  BookOpen,
  Bus,
  Coffee,
  Loader2,
  MapPin,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  TreePine,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getSuburbStats } from "@/app/actions/suburb-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuburbStats as SuburbStatsData } from "@/lib/suburb-stats/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuburbStatsProps {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#F3F4F6] ${className}`}
      aria-hidden
    />
  );
}

function CardSkeleton() {
  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat helpers
// ---------------------------------------------------------------------------

function StatRow({ label, value }: { label: string; value?: string | number }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#111827]">
        {value}
      </span>
    </div>
  );
}

function formatDistance(m?: number) {
  if (m == null) return undefined;
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function PriceContextCard({ data }: { data: SuburbStatsData }) {
  const p = data.prices;
  if (!p) return null;
  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <TrendingUp className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Property Prices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <StatRow label="Median house price" value={p.medianHouse} />
        <StatRow label="Median unit price" value={p.medianUnit} />
        <StatRow label="Annual growth (houses)" value={p.annualGrowthHouse} />
        <StatRow label="Annual growth (units)" value={p.annualGrowthUnit} />
        <StatRow label="Days on market" value={p.daysOnMarket} />
        <StatRow label="Auction clearance rate" value={p.auctionClearanceRate} />
        {!p.medianHouse && !p.medianUnit && (
          <p className="text-sm text-[#9CA3AF]">Price data unavailable.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SchoolsCard({ data }: { data: SuburbStatsData }) {
  const schools = data.schools;
  if (!schools?.length) return null;

  const primary = schools.filter(
    (s) => s.level === "primary" || s.level === "combined",
  );
  const secondary = schools.filter(
    (s) => s.level === "secondary" || s.level === "combined",
  );
  const other = schools.filter(
    (s) => s.level === "unknown" && !primary.includes(s) && !secondary.includes(s),
  );

  const renderSchool = (
    s: (typeof schools)[number],
    i: number,
  ) => (
    <div
      key={`${s.name}-${i}`}
      className="flex items-baseline justify-between gap-2 text-sm"
    >
      <div className="min-w-0">
        <span className="font-medium text-[#111827]">{s.name}</span>
        {s.rating ? (
          <span className="ml-2 text-xs text-[#6B7280]">
            {s.rating.toFixed(1)} ★
          </span>
        ) : null}
      </div>
      {s.distanceMeters != null && (
        <span className="shrink-0 tabular-nums text-[#6B7280]">
          {formatDistance(s.distanceMeters)}
        </span>
      )}
    </div>
  );

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <BookOpen className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Schools Nearby
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {primary.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Primary
            </p>
            {primary.slice(0, 4).map(renderSchool)}
          </div>
        )}
        {secondary.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Secondary
            </p>
            {secondary.slice(0, 4).map(renderSchool)}
          </div>
        )}
        {other.length > 0 && primary.length === 0 && secondary.length === 0 && (
          <div className="space-y-1">{other.slice(0, 6).map(renderSchool)}</div>
        )}
      </CardContent>
    </Card>
  );
}

function CrimeCard({ data }: { data: SuburbStatsData }) {
  const c = data.crime;
  if (!c) return null;

  const levelColor =
    c.level === "Low"
      ? "text-emerald-600 bg-emerald-50"
      : c.level === "Medium"
        ? "text-amber-600 bg-amber-50"
        : "text-red-600 bg-red-50";

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Crime Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.level && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelColor}`}
            >
              {c.level}
            </span>
            <span className="text-xs text-[#6B7280]">relative to NSW avg</span>
          </div>
        )}
        {c.categories?.map((cat) => (
          <StatRow key={cat.name} label={cat.name} value={cat.rate} />
        ))}
      </CardContent>
    </Card>
  );
}

function TransportCard({ data }: { data: SuburbStatsData }) {
  const tr = data.transport;
  if (!tr) return null;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <Bus className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Public Transport
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tr.nearestStation && (
          <StatRow
            label="Nearest train station"
            value={`${tr.nearestStation.name} (${formatDistance(tr.nearestStation.distanceMeters)})`}
          />
        )}
        {tr.trainStations && tr.trainStations.length > 1 && (
          <StatRow
            label="Train stations within 3km"
            value={tr.trainStations.length}
          />
        )}
        {tr.busStops != null && tr.busStops > 0 && (
          <StatRow label="Bus stops within 1km" value={tr.busStops} />
        )}
        {!tr.nearestStation && !tr.busStops && (
          <p className="text-sm text-[#9CA3AF]">
            No transit data available nearby.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DemographicsCard({ data }: { data: SuburbStatsData }) {
  const d = data.demographics;
  if (!d) return null;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <Users className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Demographics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <StatRow label="Median age" value={d.medianAge} />
        <StatRow label="Owners" value={d.ownerRatio} />
        <StatRow label="Renters" value={d.renterRatio} />
        <StatRow label="Median household income" value={d.medianIncome} />
        {d.topOccupations?.length ? (
          <div>
            <p className="mb-1 text-sm text-[#6B7280]">Top occupations</p>
            <div className="flex flex-wrap gap-1.5">
              {d.topOccupations.map((o) => (
                <span
                  key={o}
                  className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LifestyleCard({ data }: { data: SuburbStatsData }) {
  const l = data.lifestyle;
  if (!l) return null;

  const items = [
    { icon: Coffee, label: "Cafes within 500m", value: l.cafes.length },
    { icon: UtensilsCrossed, label: "Restaurants within 500m", value: l.restaurants.length },
    { icon: TreePine, label: "Parks within 1km", value: l.parks.length },
    { icon: ShoppingCart, label: "Supermarkets within 1km", value: l.supermarkets.length },
  ];

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <Coffee className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Lifestyle
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] p-3"
            >
              <Icon className="h-4 w-4 shrink-0 text-[#0D9488]" />
              <div className="min-w-0">
                <p className="text-lg font-bold tabular-nums text-[#111827]">
                  {value}
                </p>
                <p className="truncate text-xs text-[#6B7280]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Map section
// ---------------------------------------------------------------------------

function SuburbMap({ data }: { data: SuburbStatsData }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const loc = data.propertyLocation;

  useEffect(() => {
    if (!loc || !mapRef.current) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    let map: google.maps.Map | undefined;

    function initMap() {
      if (!mapRef.current || !loc) return;
      map = new google.maps.Map(mapRef.current, {
        center: loc,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      new google.maps.Marker({
        position: loc,
        map,
        title: `${data.suburb} ${data.postcode}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#0D9488",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    }

    if (typeof google !== "undefined" && google.maps) {
      initMap();
      return;
    }

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      existing.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initMap);
    document.head.appendChild(script);
  }, [loc, data.suburb, data.postcode]);

  if (!loc) return null;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <MapPin className="h-4 w-4" />
        </span>
        <CardTitle className="text-sm font-semibold text-[#111827]">
          Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={mapRef}
          className="h-64 w-full overflow-hidden rounded-lg border border-[#E5E7EB]"
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SuburbStats({
  address,
  suburb,
  state,
  postcode,
}: SuburbStatsProps) {
  const [data, setData] = useState<SuburbStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      const result = await getSuburbStats(address, suburb, state, postcode);
      setData(result);
    } catch (e) {
      console.error("[suburb-stats] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [address, suburb, state, postcode]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
          Loading suburb data for {suburb}…
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[#6B7280]">
        Could not load suburb data. Try refreshing the page.
      </p>
    );
  }

  const hasAnyData =
    data.prices ||
    data.schools?.length ||
    data.crime ||
    data.transport ||
    data.demographics ||
    data.lifestyle;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[#111827]">
          {suburb} {postcode}
        </h3>
        <p className="text-sm text-[#6B7280]">
          Suburb insights for your property search
        </p>
      </div>

      {!hasAnyData ? (
        <p className="text-sm text-[#9CA3AF]">
          No suburb data available for {suburb} {state} {postcode}.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceContextCard data={data} />
          <LifestyleCard data={data} />
          <SchoolsCard data={data} />
          <TransportCard data={data} />
          <DemographicsCard data={data} />
          <CrimeCard data={data} />
        </div>
      )}

      <SuburbMap data={data} />

      {data.sources.length > 0 && (
        <p className="text-xs text-[#9CA3AF]">
          Data sourced from {data.sources.join(", ")}. Cached for 24 hours.
        </p>
      )}
    </div>
  );
}
