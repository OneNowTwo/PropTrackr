"use client";

import {
  BookOpen,
  Bus,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  Loader2,
  MapPin,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  TreePine,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { getSuburbPlacesData } from "@/app/actions/suburb-data";
import { followSuburb, unfollowSuburb } from "@/app/actions/suburbs";
import { useAigent } from "@/components/agent/aigent-modal";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NearbyPlace, SuburbStats } from "@/lib/suburb-stats/types";
import { cn, formatAud } from "@/lib/utils";
import type { Property } from "@/types/property";

// ---------------------------------------------------------------------------
// Constants / Helpers
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

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < full
              ? "fill-amber-400 text-amber-400"
              : i === full && half
                ? "fill-amber-400/50 text-amber-400"
                : "fill-[#E5E7EB] text-[#E5E7EB]",
          )}
        />
      ))}
      <span className="ml-1 text-sm font-semibold tabular-nums text-[#111827]">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function PriceLevel({ level }: { level: number }) {
  return (
    <span className="text-xs text-[#6B7280]">
      {"$".repeat(level)}
      <span className="text-[#E5E7EB]">{"$".repeat(4 - level)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ data, propCount, suburb, postcode, onAsk }: { data: SuburbStats; propCount: number; suburb: string; postcode: string; onAsk: (msg: string) => void }) {
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
          <StatRow label="Train stations" value={data.transport?.trainStations?.length} />
          <StatRow label="Cafes nearby" value={data.lifestyle?.cafes.length} />
          <StatRow label="Parks nearby" value={data.lifestyle?.parks.length} />
        </CardContent>
      </Card>

      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={() =>
            onAsk(
              `Give me a buyers agent perspective on ${suburb} ${postcode}. Is it a good time to buy there? What are the risks and opportunities?`,
            )
          }
          className="flex w-full items-center gap-2 rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3 text-sm font-semibold text-[#0D9488] transition-colors hover:bg-[#0D9488]/10"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          Ask Buyers Aigent about {suburb} →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties Tab — with hover support
// ---------------------------------------------------------------------------

function PropertiesTab({
  properties: props,
  hoveredId,
  onHover,
}: {
  properties: Property[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  if (props.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <MapPin className="h-10 w-10 text-[#D1D5DB]" strokeWidth={1.25} />
          <p className="text-sm text-[#6B7280]">No saved properties in this suburb yet.</p>
          <Button variant="outline" size="sm" className="border-[#E5E7EB]" asChild>
            <Link href="/properties/new">Add Property</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {props.map((p) => (
        <li
          key={p.id}
          onMouseEnter={() => onHover(p.id)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "rounded-xl transition-shadow duration-200",
            hoveredId === p.id && "ring-2 ring-[#0D9488] shadow-lg",
          )}
        >
          <PropertyCard property={p} />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Schools Tab
// ---------------------------------------------------------------------------

function SchoolsTab({ data }: { data: SuburbStats }) {
  const schools = data.schools;
  if (!schools?.length) return <p className="text-sm text-[#9CA3AF]">No school data available.</p>;

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

// ---------------------------------------------------------------------------
// Transport Tab
// ---------------------------------------------------------------------------

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
                        {formatDist(s.distanceMeters)} · ~{Math.round((s.distanceMeters / 1000) * 12)} min walk
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
            <p className="text-sm font-semibold text-[#111827]">
              {tr.busStops} bus stop{tr.busStops === 1 ? "" : "s"} within 1km
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifestyle Tab — full detail view with photos + carousel arrows
// ---------------------------------------------------------------------------

function PlaceCard({
  place,
  fallbackIcon: FallbackIcon,
  isHovered,
  onHoverPlace,
}: {
  place: NearbyPlace;
  fallbackIcon: ComponentType<{ className?: string }>;
  isHovered?: boolean;
  onHoverPlace?: (id: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => place.placeId && onHoverPlace?.(place.placeId)}
      onMouseLeave={() => onHoverPlace?.(null)}
      className={cn(
        "flex min-w-[260px] max-w-xs shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow duration-200",
        isHovered ? "border-[#0D9488] ring-2 ring-[#0D9488] shadow-lg" : "border-[#E5E7EB]",
      )}
    >
      {/* Photo header */}
      <div className="relative h-[120px] w-full overflow-hidden bg-[#F3F4F6]">
        {place.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.photoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0D9488]/10 to-[#0D9488]/5">
            <FallbackIcon className="h-10 w-10 text-[#0D9488]/30" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm font-bold leading-tight text-[#111827]">{place.name}</p>

        {place.rating != null && (
          <div className="mt-1.5 flex items-center gap-2">
            <StarRating rating={place.rating} />
            {place.userRatingsTotal != null && (
              <span className="text-xs text-[#9CA3AF]">
                ({place.userRatingsTotal.toLocaleString()})
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B7280]">
          {place.distanceMeters != null && (
            <span>{formatDist(place.distanceMeters)} away</span>
          )}
          {place.priceLevel != null && place.priceLevel > 0 && (
            <PriceLevel level={place.priceLevel} />
          )}
          {place.openNow != null && (
            <span className={place.openNow ? "font-medium text-emerald-600" : "text-red-500"}>
              {place.openNow ? "Open now" : "Closed"}
            </span>
          )}
        </div>

        {place.vicinity && (
          <p className="mt-1.5 truncate text-xs text-[#9CA3AF]">{place.vicinity}</p>
        )}

        {place.placeId && (
          <a
            href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-[#0D9488] hover:underline"
          >
            View on Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function LifestyleCategory({
  icon: Icon,
  label,
  radius,
  places,
  hoveredPlaceId,
  onHoverPlace,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  radius: string;
  places: NearbyPlace[];
  hoveredPlaceId: string | null;
  onHoverPlace: (id: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, places]);

  const scroll = useCallback((dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  }, []);

  if (places.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-semibold text-[#111827]">
          {label}{" "}
          <span className="font-normal text-[#9CA3AF]">
            ({places.length} within {radius})
          </span>
        </h4>
      </div>

      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="absolute -left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#374151] shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            aria-label={`Scroll ${label} left`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Scrollable list */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {places.map((p, i) => (
            <PlaceCard
              key={`${p.placeId ?? p.name}-${i}`}
              place={p}
              fallbackIcon={Icon}
              isHovered={!!p.placeId && p.placeId === hoveredPlaceId}
              onHoverPlace={onHoverPlace}
            />
          ))}
        </div>

        {/* Right arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute -right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#374151] shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            aria-label={`Scroll ${label} right`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function LifestyleTab({
  data,
  hoveredPlaceId,
  onHoverPlace,
}: {
  data: SuburbStats;
  hoveredPlaceId: string | null;
  onHoverPlace: (id: string | null) => void;
}) {
  const l = data.lifestyle;
  if (!l) return <p className="text-sm text-[#9CA3AF]">No lifestyle data available.</p>;

  return (
    <div className="space-y-8">
      <LifestyleCategory icon={Coffee} label="Cafes" radius="500m" places={l.cafes} hoveredPlaceId={hoveredPlaceId} onHoverPlace={onHoverPlace} />
      <LifestyleCategory icon={UtensilsCrossed} label="Restaurants" radius="500m" places={l.restaurants} hoveredPlaceId={hoveredPlaceId} onHoverPlace={onHoverPlace} />
      <LifestyleCategory icon={TreePine} label="Parks" radius="1km" places={l.parks} hoveredPlaceId={hoveredPlaceId} onHoverPlace={onHoverPlace} />
      <LifestyleCategory icon={ShoppingCart} label="Supermarkets" radius="1km" places={l.supermarkets} hoveredPlaceId={hoveredPlaceId} onHoverPlace={onHoverPlace} />
      {l.cafes.length === 0 && l.restaurants.length === 0 && l.parks.length === 0 && l.supermarkets.length === 0 && (
        <p className="text-sm text-[#9CA3AF]">No lifestyle data available for this area.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market Tab
// ---------------------------------------------------------------------------

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
// Map with hover interaction + lifestyle markers
// ---------------------------------------------------------------------------

type MarkerEntry = {
  propertyId: string;
  marker: google.maps.Marker;
  property: Property;
};

type PlaceMarkerEntry = {
  placeId: string;
  marker: google.maps.Marker;
  place: NearbyPlace;
  category: string;
};

const LIFESTYLE_COLORS: Record<string, string> = {
  cafes: "#F59E0B",
  restaurants: "#EF4444",
  parks: "#22C55E",
  supermarkets: "#8B5CF6",
};

function SuburbMapSection({
  data,
  properties: props,
  hoveredId,
  onHover,
  hoveredPlaceId,
  onHoverPlace,
}: {
  data: SuburbStats | null;
  properties: Property[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  hoveredPlaceId: string | null;
  onHoverPlace: (id: string | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map>();
  const markersRef = useRef<MarkerEntry[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow>();
  const placeMarkersRef = useRef<PlaceMarkerEntry[]>([]);
  const [showPlaces, setShowPlaces] = useState(false);
  const showPlacesRef = useRef(false);
  showPlacesRef.current = showPlaces;
  const loc = data?.propertyLocation;

  // Initialize map + all markers (property + lifestyle) in one go
  useEffect(() => {
    if (!loc || !mapRef.current || !MAPS_KEY) return;

    function initMap() {
      if (!mapRef.current || !loc) return;
      const map = new google.maps.Map(mapRef.current, {
        center: loc,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // Suburb center marker
      new google.maps.Marker({
        position: loc,
        map,
        title: data?.suburb ?? "",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#0D9488",
          fillOpacity: 0.2,
          strokeColor: "#0D9488",
          strokeWeight: 2,
        },
        zIndex: 1,
      });

      // --- Property markers (async geocoding) ---
      if (props.length > 0) {
        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(loc);
        const entries: MarkerEntry[] = [];

        let completed = 0;
        for (const p of props.slice(0, 20)) {
          const addr = [p.address, p.suburb, p.state, p.postcode, "Australia"]
            .filter(Boolean)
            .join(", ");
          geocoder.geocode({ address: addr }, (results, status) => {
            completed++;
            if (status === "OK" && results?.[0]) {
              const pos = results[0].geometry.location;
              bounds.extend(pos);
              const marker = new google.maps.Marker({
                position: pos,
                map,
                title: p.address,
                icon: tealPin(10),
                zIndex: 10,
              });
              marker.addListener("mouseover", () => onHover(p.id));
              marker.addListener("mouseout", () => onHover(null));
              entries.push({ propertyId: p.id, marker, property: p });
            }
            if (completed === Math.min(props.length, 20)) {
              map.fitBounds(bounds, { top: 30, bottom: 30, left: 30, right: 30 });
            }
          });
        }
        markersRef.current = entries;
      }

      // --- Lifestyle markers (using coordinates from Places API) ---
      const lifestyle = data?.lifestyle;
      if (lifestyle) {
        const placeEntries: PlaceMarkerEntry[] = [];
        for (const [cat, places] of Object.entries(lifestyle)) {
          for (const place of places as NearbyPlace[]) {
            if (place.lat == null || place.lng == null || !place.placeId) continue;
            const color = LIFESTYLE_COLORS[cat] ?? "#6B7280";
            const marker = new google.maps.Marker({
              position: { lat: place.lat, lng: place.lng },
              map,
              title: place.name,
              icon: lifestylePin(color, 6),
              visible: showPlacesRef.current,
              zIndex: 5,
            });
            marker.addListener("mouseover", () => onHoverPlace(place.placeId!));
            marker.addListener("mouseout", () => onHoverPlace(null));
            placeEntries.push({ placeId: place.placeId, marker, place, category: cat });
          }
        }
        placeMarkersRef.current = placeEntries;
        console.log("[map] lifestyle markers created:", placeEntries.length);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc, props, data?.suburb]);

  // Property hover — highlight pin + InfoWindow
  useEffect(() => {
    const map = mapInstanceRef.current;
    const iw = infoWindowRef.current;
    if (!map || !iw) return;

    for (const entry of markersRef.current) {
      if (entry.propertyId === hoveredId) {
        entry.marker.setIcon(amberPin(14));
        entry.marker.setZIndex(100);
        openPropertyInfoWindow(iw, map, entry.marker, entry.property);
      } else {
        entry.marker.setIcon(tealPin(10));
        entry.marker.setZIndex(10);
      }
    }

    if (!hoveredId && !hoveredPlaceId) iw.close();
  }, [hoveredId, hoveredPlaceId]);

  // Toggle visibility of lifestyle markers
  useEffect(() => {
    for (const entry of placeMarkersRef.current) {
      const isHovered = entry.placeId === hoveredPlaceId;
      entry.marker.setVisible(showPlaces || isHovered);
    }
  }, [showPlaces, hoveredPlaceId]);

  // Place hover — highlight marker + InfoWindow
  useEffect(() => {
    const map = mapInstanceRef.current;
    const iw = infoWindowRef.current;
    if (!map || !iw) return;

    for (const entry of placeMarkersRef.current) {
      const color = LIFESTYLE_COLORS[entry.category] ?? "#6B7280";
      if (entry.placeId === hoveredPlaceId) {
        entry.marker.setVisible(true);
        entry.marker.setIcon(lifestylePin("#F59E0B", 10));
        entry.marker.setZIndex(100);
        openPlaceInfoWindow(iw, map, entry.marker, entry.place);
      } else {
        entry.marker.setIcon(lifestylePin(color, 6));
        entry.marker.setZIndex(5);
        entry.marker.setVisible(showPlacesRef.current);
      }
    }

    if (!hoveredPlaceId && !hoveredId) iw.close();
  }, [hoveredPlaceId, hoveredId]);

  if (!MAPS_KEY || !loc) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#6B7280]">
          <input
            type="checkbox"
            checked={showPlaces}
            onChange={(e) => setShowPlaces(e.target.checked)}
            className="h-4 w-4 rounded border-[#D1D5DB] text-[#0D9488] focus:ring-[#0D9488]"
          />
          Show nearby places
        </label>
        {showPlaces && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF]">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />Cafes</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />Restaurants</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E]" />Parks</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" />Shops</span>
          </div>
        )}
      </div>
      <div
        ref={mapRef}
        className="h-[400px] w-full overflow-hidden rounded-xl border border-[#E5E7EB] shadow-sm"
      />
    </div>
  );
}

function tealPin(scale: number) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: "#0D9488",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function amberPin(scale: number) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: "#F59E0B",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function lifestylePin(color: string, scale: number) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 0.8,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
  };
}

function openPropertyInfoWindow(
  iw: google.maps.InfoWindow,
  map: google.maps.Map,
  marker: google.maps.Marker,
  p: Property,
) {
  const bg = p.status === "shortlisted" ? "#ECFDF5" : p.status === "inspecting" ? "#EFF6FF" : p.status === "passed" ? "#F3F4F6" : "#F9FAFB";
  const fg = p.status === "shortlisted" ? "#059669" : p.status === "inspecting" ? "#2563EB" : p.status === "passed" ? "#6B7280" : "#374151";
  iw.setContent(`
    <div style="max-width:240px;font-family:system-ui,sans-serif">
      ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:6px 6px 0 0" />` : ""}
      <div style="padding:8px 10px">
        <div style="font-weight:600;font-size:13px;color:#111827">${p.address}</div>
        <div style="font-weight:700;font-size:14px;color:#0D9488;margin-top:4px">${formatAud(p.price)}</div>
        <div style="margin-top:4px">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${bg};color:${fg}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        </div>
      </div>
    </div>`);
  iw.open(map, marker);
}

function openPlaceInfoWindow(
  iw: google.maps.InfoWindow,
  map: google.maps.Map,
  marker: google.maps.Marker,
  p: NearbyPlace,
) {
  const stars = p.rating != null ? `${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))} ${p.rating.toFixed(1)}` : "";
  const dist = p.distanceMeters != null ? formatDist(p.distanceMeters) : "";
  const status = p.openNow != null ? (p.openNow ? '<span style="color:#059669">Open</span>' : '<span style="color:#EF4444">Closed</span>') : "";
  iw.setContent(`
    <div style="max-width:220px;font-family:system-ui,sans-serif">
      ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:6px 6px 0 0" />` : ""}
      <div style="padding:6px 8px">
        <div style="font-weight:600;font-size:13px;color:#111827">${p.name}</div>
        ${stars ? `<div style="font-size:12px;color:#F59E0B;margin-top:2px">${stars}</div>` : ""}
        <div style="font-size:11px;color:#6B7280;margin-top:2px">${[dist, status].filter(Boolean).join(" · ")}</div>
      </div>
    </div>`);
  iw.open(map, marker);
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
}: {
  suburb: string;
  state: string;
  postcode: string;
  followedId: string | null;
  properties: Property[];
}) {
  const { open: openAigent } = useAigent();
  const [data, setData] = useState<SuburbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFollowId, setCurrentFollowId] = useState(followedId);
  const [isPending, startTransition] = useTransition();
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
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
          <p className="mt-1 text-[#6B7280]">{state} {postcode}</p>
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
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {currentFollowId ? "Unfollow" : "Follow Suburb"}
        </Button>
      </div>

      {/* Map — above tabs on mobile, inside tab content on desktop */}
      {!loading && data && (
        <div className="md:hidden">
          <SuburbMapSection
            data={data}
            properties={props}
            hoveredId={hoveredPropertyId}
            onHover={setHoveredPropertyId}
            hoveredPlaceId={hoveredPlaceId}
            onHoverPlace={setHoveredPlaceId}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="flex w-max gap-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1 md:inline-flex md:w-auto md:flex-wrap">
            {["overview", "properties", "schools", "transport", "lifestyle", "market"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium capitalize data-[state=active]:bg-white data-[state=active]:text-[#0D9488] data-[state=active]:shadow-sm"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

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
          <div className="mt-6 space-y-6">
            <div className="hidden md:block">
              <SuburbMapSection
                data={data}
                properties={props}
                hoveredId={hoveredPropertyId}
                onHover={setHoveredPropertyId}
                hoveredPlaceId={hoveredPlaceId}
                onHoverPlace={setHoveredPlaceId}
              />
            </div>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab data={data} propCount={props.length} suburb={suburb} postcode={postcode} onAsk={openAigent} />
            </TabsContent>
            <TabsContent value="properties" className="mt-0">
              <PropertiesTab properties={props} hoveredId={hoveredPropertyId} onHover={setHoveredPropertyId} />
            </TabsContent>
            <TabsContent value="schools" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <SchoolsTab data={data} />
              </div>
            </TabsContent>
            <TabsContent value="transport" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <TransportTab data={data} />
              </div>
            </TabsContent>
            <TabsContent value="lifestyle" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <LifestyleTab data={data} hoveredPlaceId={hoveredPlaceId} onHoverPlace={setHoveredPlaceId} />
              </div>
            </TabsContent>
            <TabsContent value="market" className="mt-0">
              <MarketTab />
            </TabsContent>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[#9CA3AF]">Could not load suburb data. Try refreshing.</p>
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
