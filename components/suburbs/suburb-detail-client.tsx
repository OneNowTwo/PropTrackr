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
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { getSuburbPlacesData } from "@/app/actions/suburb-data";
import { followSuburb, unfollowSuburb } from "@/app/actions/suburbs";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SuburbStats } from "@/lib/suburb-stats/types";
import type { Property } from "@/types/property";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuburbDetailClientProps {
  suburb: string;
  state: string;
  postcode: string;
  followedId: string | null;
  properties: Property[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#F3F4F6] ${className}`} />;
}

function StatRow({ label, value }: { label: string; value?: string | number }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#111827]">{value}</span>
    </div>
  );
}

function formatDist(m?: number) {
  if (m == null) return "";
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

// ---------------------------------------------------------------------------
// Sub-components for tabs
// ---------------------------------------------------------------------------

function OverviewTab({ data, propCount }: { data: SuburbStats; propCount: number }) {
  const p = data.prices;
  const d = data.demographics;
  const c = data.crime;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <TrendingUp className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-semibold text-[#111827]">Market</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatRow label="Median house price" value={p?.medianHouse} />
          <StatRow label="Median unit price" value={p?.medianUnit} />
          <StatRow label="Annual growth (houses)" value={p?.annualGrowthHouse} />
          <StatRow label="Days on market" value={p?.daysOnMarket} />
          <StatRow label="Auction clearance rate" value={p?.auctionClearanceRate} />
          {!p?.medianHouse && !p?.medianUnit && (
            <p className="text-sm text-[#9CA3AF]">Price data unavailable.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <Users className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-semibold text-[#111827]">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatRow label="Median age" value={d?.medianAge} />
          <StatRow label="Owners" value={d?.ownerRatio} />
          <StatRow label="Renters" value={d?.renterRatio} />
          <StatRow label="Median household income" value={d?.medianIncome} />
          {!d && <p className="text-sm text-[#9CA3AF]">Demographics unavailable.</p>}
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-semibold text-[#111827]">Crime</CardTitle>
        </CardHeader>
        <CardContent>
          {c?.level ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                c.level === "Low"
                  ? "bg-emerald-50 text-emerald-600"
                  : c.level === "Medium"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-red-50 text-red-600"
              }`}
            >
              {c.level}
            </span>
          ) : (
            <p className="text-sm text-[#9CA3AF]">Crime data unavailable.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <MapPin className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-semibold text-[#111827]">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatRow label="Saved properties" value={propCount} />
          <StatRow label="Schools nearby" value={data.schools?.length} />
          <StatRow
            label="Train stations"
            value={data.transport?.trainStations?.length}
          />
          <StatRow label="Cafes nearby" value={data.lifestyle?.cafes} />
          <StatRow label="Parks nearby" value={data.lifestyle?.parks} />
        </CardContent>
      </Card>
    </div>
  );
}

function PropertiesTab({ properties: props }: { properties: Property[] }) {
  if (props.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <MapPin className="h-10 w-10 text-[#D1D5DB]" strokeWidth={1.25} />
          <p className="text-sm text-[#6B7280]">No saved properties in this suburb yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="border-[#E5E7EB]"
            asChild
          >
            <Link href="/properties/new">Add Property</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {props.map((p) => (
        <li key={p.id}>
          <PropertyCard property={p} />
        </li>
      ))}
    </ul>
  );
}

function SchoolsTab({ data }: { data: SuburbStats }) {
  const schools = data.schools;
  if (!schools?.length)
    return <p className="text-sm text-[#9CA3AF]">No school data available.</p>;

  const primary = schools.filter((s) => s.level === "primary" || s.level === "combined");
  const secondary = schools.filter((s) => s.level === "secondary" || s.level === "combined");
  const other = schools.filter((s) => s.level === "unknown");

  const renderGroup = (title: string, list: typeof schools) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{title}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.slice(0, 6).map((s, i) => (
            <Card key={`${s.name}-${i}`} className="border-[#E5E7EB] bg-white shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111827]">{s.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#6B7280]">
                    {s.distanceMeters != null && <span>{formatDist(s.distanceMeters)}</span>}
                    {s.rating != null && <span>{s.rating.toFixed(1)} ★</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderGroup("Primary Schools", primary)}
      {renderGroup("Secondary Schools", secondary)}
      {other.length > 0 && primary.length === 0 && secondary.length === 0 && renderGroup("Schools", other)}
    </div>
  );
}

function TransportTab({ data }: { data: SuburbStats }) {
  const tr = data.transport;
  if (!tr || (!tr.trainStations?.length && !tr.busStops))
    return <p className="text-sm text-[#9CA3AF]">No transport data available.</p>;

  return (
    <div className="space-y-6">
      {tr.trainStations && tr.trainStations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Train Stations</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {tr.trainStations.map((s, i) => (
              <Card key={`${s.name}-${i}`} className="border-[#E5E7EB] bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                    <Bus className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827]">{s.name}</p>
                    {s.distanceMeters != null && (
                      <p className="text-xs text-[#6B7280]">
                        {formatDist(s.distanceMeters)} ·{" "}
                        ~{Math.round((s.distanceMeters / 1000) * 12)} min walk
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {tr.busStops != null && tr.busStops > 0 && (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
              <Bus className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                {tr.busStops} bus stop{tr.busStops === 1 ? "" : "s"} within 1km
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LifestyleTab({ data }: { data: SuburbStats }) {
  const l = data.lifestyle;
  if (!l) return <p className="text-sm text-[#9CA3AF]">No lifestyle data available.</p>;

  const cats = [
    { icon: Coffee, label: "Cafes", sub: "within 500m", count: l.cafes },
    { icon: UtensilsCrossed, label: "Restaurants", sub: "within 500m", count: l.restaurants },
    { icon: TreePine, label: "Parks", sub: "within 1km", count: l.parks },
    { icon: ShoppingCart, label: "Supermarkets", sub: "within 1km", count: l.supermarkets },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cats.map(({ icon: Icon, label, sub, count }) => (
        <Card key={label} className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[#111827]">{count}</p>
              <p className="text-sm text-[#6B7280]">
                {label} <span className="text-[#9CA3AF]">{sub}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MarketTab() {
  const placeholders = [
    { title: "Median Price Trend", desc: "Historical price data coming soon" },
    { title: "Recent Sales", desc: "Sold property data coming soon" },
    { title: "Price by Property Type", desc: "House vs unit vs townhouse breakdown coming soon" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {placeholders.map((p) => (
        <Card key={p.title} className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <TrendingUp className="h-8 w-8 text-[#D1D5DB]" />
            <p className="text-sm font-semibold text-[#111827]">{p.title}</p>
            <p className="text-xs text-[#9CA3AF]">{p.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function SuburbMapSection({
  data,
  properties: props,
}: {
  data: SuburbStats | null;
  properties: Property[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const loc = data?.propertyLocation;

  useEffect(() => {
    if (!loc || !mapRef.current || !MAPS_KEY) return;

    let map: google.maps.Map | undefined;

    function initMap() {
      if (!mapRef.current || !loc) return;
      map = new google.maps.Map(mapRef.current, {
        center: loc,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });

      // Suburb center marker
      new google.maps.Marker({
        position: loc,
        map,
        title: data?.suburb ?? "",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#0D9488",
          fillOpacity: 0.3,
          strokeColor: "#0D9488",
          strokeWeight: 2,
        },
      });

      // Property markers
      if (props.length > 0 && typeof google !== "undefined") {
        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(loc);

        for (const p of props.slice(0, 20)) {
          const addr = [p.address, p.suburb, p.state, p.postcode, "Australia"]
            .filter(Boolean)
            .join(", ");
          geocoder.geocode({ address: addr }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              const pos = results[0].geometry.location;
              bounds.extend(pos);
              new google.maps.Marker({
                position: pos,
                map,
                title: p.address,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#0D9488",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                },
              });
              if (map) map.fitBounds(bounds, { top: 30, bottom: 30, left: 30, right: 30 });
            }
          });
        }
      }
    }

    if (typeof google !== "undefined" && google.maps) {
      initMap();
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initMap);
    document.head.appendChild(script);
  }, [loc, props, data?.suburb]);

  if (!MAPS_KEY || !loc) return null;

  return (
    <div
      ref={mapRef}
      className="h-[400px] w-full overflow-hidden rounded-xl border border-[#E5E7EB] shadow-sm"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SuburbDetailClient({
  suburb,
  state,
  postcode,
  followedId,
  properties: props,
}: SuburbDetailClientProps) {
  const [data, setData] = useState<SuburbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFollowId, setCurrentFollowId] = useState(followedId);
  const [isPending, startTransition] = useTransition();
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      const result = await getSuburbPlacesData(suburb, state, postcode);
      setData(result);
    } catch (e) {
      console.error("[suburb-detail] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [suburb, state, postcode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = useCallback(() => {
    startTransition(async () => {
      if (currentFollowId) {
        await unfollowSuburb(currentFollowId);
        setCurrentFollowId(null);
      } else {
        const res = await followSuburb(suburb, state, postcode);
        if (res.ok) setCurrentFollowId("pending");
      }
    });
  }, [currentFollowId, suburb, state, postcode]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            {suburb}
          </h1>
          <p className="mt-1 text-[#6B7280]">
            {state} {postcode}
          </p>
        </div>
        <Button
          onClick={toggleFollow}
          disabled={isPending}
          variant={currentFollowId ? "outline" : "default"}
          className={
            currentFollowId
              ? "border-[#E5E7EB] text-[#6B7280] hover:border-red-300 hover:text-red-500"
              : "bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
          }
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {currentFollowId ? "Unfollow" : "Follow Suburb"}
        </Button>
      </div>

      {/* Map */}
      <SuburbMapSection data={data} properties={props} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="h-10 flex-wrap rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          {["overview", "properties", "schools", "transport", "lifestyle", "market"].map(
            (t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-md px-3 text-sm font-medium capitalize data-[state=active]:bg-white data-[state=active]:text-[#0D9488] data-[state=active]:shadow-sm"
              >
                {t}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        {loading ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
              Loading suburb data…
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-[#E5E7EB] bg-white shadow-sm">
                  <CardContent className="space-y-3 p-5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            <TabsContent value="overview" className="mt-6">
              <OverviewTab data={data} propCount={props.length} />
            </TabsContent>
            <TabsContent value="properties" className="mt-6">
              <PropertiesTab properties={props} />
            </TabsContent>
            <TabsContent value="schools" className="mt-6">
              <SchoolsTab data={data} />
            </TabsContent>
            <TabsContent value="transport" className="mt-6">
              <TransportTab data={data} />
            </TabsContent>
            <TabsContent value="lifestyle" className="mt-6">
              <LifestyleTab data={data} />
            </TabsContent>
            <TabsContent value="market" className="mt-6">
              <MarketTab />
            </TabsContent>
          </>
        ) : (
          <p className="mt-6 text-sm text-[#9CA3AF]">
            Could not load suburb data. Try refreshing.
          </p>
        )}
      </Tabs>

      {data?.sources && data.sources.length > 0 && (
        <p className="text-xs text-[#9CA3AF]">
          Data sourced from {data.sources.join(", ")}. Cached for 24 hours.
        </p>
      )}
    </div>
  );
}
