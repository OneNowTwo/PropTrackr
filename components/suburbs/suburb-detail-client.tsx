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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  getSuburbBasePlacesData,
  getSuburbDemographicsData,
} from "@/app/actions/suburb-data";
import { followSuburb, unfollowSuburb } from "@/app/actions/suburbs";
import { nswBocsarCrimePlaceholder } from "@/lib/suburb-stats/bocsar-placeholder";
import { communitySaleResultsToPrices } from "@/lib/suburb-stats/community-market";
import { useAigent } from "@/components/agent/aigent-modal";
import type { MarketSaleResultRow } from "@/components/market/market-intelligence-client";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  NearbyPlace,
  SuburbDemographics,
  SuburbStats,
} from "@/lib/suburb-stats/types";
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

function OverviewTab({
  data,
  propCount,
  suburb,
  postcode,
  state,
  demoLoading,
  onAsk,
}: {
  data: SuburbStats;
  propCount: number;
  suburb: string;
  postcode: string;
  state: string;
  demoLoading: boolean;
  onAsk: (msg: string) => void;
}) {
  const p = data.prices;
  const d = data.demographics;
  const c = data.crime;
  const hasDemo =
    !!d &&
    Boolean(
      d.medianAge ||
        d.ownerRatio ||
        d.renterRatio ||
        d.medianIncome ||
        (d.topOccupations && d.topOccupations.length > 0) ||
        d.region ||
        d.adminDistrict ||
        d.constituency,
    );

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
          <p className="text-xs text-[#9CA3AF]">
            Market data powered by PropTrackr community — your logged sale results.
          </p>
          <StatRow label="Median house / main sales" value={p?.medianHouse} />
          <StatRow label="Median unit" value={p?.medianUnit} />
          <StatRow label="Avg days on market (logged)" value={p?.daysOnMarket} />
          <StatRow label="Auction clearance (logged)" value={p?.auctionClearanceRate} />
          {!p?.medianHouse && !p?.medianUnit ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-[#6B7280]">
                No market data yet. Log sale results to build your market intelligence for
                this suburb.
              </p>
              <Link
                href="/market"
                className="inline-flex text-sm font-semibold text-[#0D9488] hover:underline"
              >
                Open Market →
              </Link>
            </div>
          ) : null}
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
          {demoLoading && !hasDemo ? (
            <div className="flex items-center gap-2 py-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
              Loading demographics…
            </div>
          ) : null}
          <StatRow label="Median age" value={d?.medianAge} />
          <StatRow label="Own home" value={d?.ownerRatio} />
          <StatRow label="Rent" value={d?.renterRatio} />
          <StatRow label="Weekly income" value={d?.medianIncome} />
          <StatRow label="Region" value={d?.region} />
          <StatRow label="District" value={d?.adminDistrict} />
          <StatRow label="Constituency" value={d?.constituency} />
          {d?.topOccupations?.length ? (
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
          {!demoLoading && !hasDemo ? (
            <p className="text-sm text-[#9CA3AF]">Demographics unavailable.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm font-semibold text-[#111827]">Crime</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {c?.externalUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-[#6B7280]">
                {c.summary ??
                  `View crime statistics for ${suburb} on the NSW BOCSAR site.`}
              </p>
              <a
                href={c.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0D9488] hover:underline"
              >
                View crime statistics on BOCSAR
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}
          {c?.level ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#6B7280]">Overall</span>
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
            </div>
          ) : null}
          {c?.topCrimes?.length ? (
            <ul className="space-y-1 text-sm text-[#374151]">
              {c.topCrimes.map((t, i) => (
                <li key={`${t.type}-${i}`}>
                  <span className="font-medium">{t.type}</span>
                  {t.count != null ? (
                    <span className="tabular-nums text-[#6B7280]">
                      {" "}
                      · {t.count}
                    </span>
                  ) : null}
                  {t.trend ? (
                    <span className="text-[#6B7280]"> ({t.trend})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {!c?.topCrimes?.length && c?.categories?.length
            ? c.categories.map((cat) => (
                <StatRow key={cat.name} label={cat.name} value={cat.rate} />
              ))
            : null}
          {c?.comparedToNSWAverage ? (
            <p className="text-sm text-[#6B7280]">
              Compared to NSW average:{" "}
              <span className="font-semibold text-[#111827]">
                {c.comparedToNSWAverage}
              </span>
            </p>
          ) : null}
          {!c?.externalUrl &&
          !c?.level &&
          !c?.topCrimes?.length &&
          !c?.categories?.length &&
          !c?.comparedToNSWAverage ? (
            <p className="text-sm text-[#9CA3AF]">
              {state.toUpperCase() === "NSW"
                ? "Crime link unavailable."
                : "Official suburb crime summaries are linked for NSW. Other states: check your local justice statistics portal."}
            </p>
          ) : null}
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

function MarketTab({ loggedSales }: { loggedSales: MarketSaleResultRow[] }) {
  if (loggedSales.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <TrendingUp className="h-8 w-8 text-[#D1D5DB]" />
          <p className="text-sm font-semibold text-[#111827]">
            Your sale results
          </p>
          <p className="max-w-md text-xs text-[#9CA3AF]">
            Log auction and private treaty results in Market to see them here for
            this suburb.
          </p>
          <Link
            href="/market"
            className="text-sm font-semibold text-[#0D9488] hover:underline"
          >
            Open Market →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B7280]">
        Sale results you&apos;ve logged for this suburb ({loggedSales.length}).
      </p>
      <div className="hidden overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white shadow-sm md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loggedSales.map((r) => (
              <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0">
                <td className="px-4 py-3 font-medium text-[#111827]">
                  {r.address?.trim() || "—"}
                </td>
                <td className="px-4 py-3 font-bold tabular-nums text-emerald-600">
                  {formatAud(r.salePrice)}
                </td>
                <td className="px-4 py-3 text-[#6B7280]">
                  {r.saleType === "auction"
                    ? "Auction"
                    : r.saleType === "private_treaty"
                      ? "Private Treaty"
                      : r.saleType === "expression_of_interest"
                        ? "EOI"
                        : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-[#6B7280]">
                  {Date.parse(`${r.saleDate}T12:00:00`)
                    ? new Date(`${r.saleDate}T12:00:00`).toLocaleDateString(
                        "en-AU",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )
                    : r.saleDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {loggedSales.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
          >
            <p className="font-semibold text-[#111827]">
              {r.address?.trim() || "—"}
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-600 tabular-nums">
              {formatAud(r.salePrice)}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {r.saleType === "auction"
                ? "Auction"
                : r.saleType === "private_treaty"
                  ? "Private Treaty"
                  : r.saleType === "expression_of_interest"
                    ? "EOI"
                    : "—"}{" "}
              ·{" "}
              {Date.parse(`${r.saleDate}T12:00:00`)
                ? new Date(`${r.saleDate}T12:00:00`).toLocaleDateString(
                    "en-AU",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )
                : r.saleDate}
            </p>
          </li>
        ))}
      </ul>
      <Link
        href="/market"
        className="inline-flex text-sm font-semibold text-[#0D9488] hover:underline"
      >
        Manage in Market →
      </Link>
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
  loggedSaleResults,
}: {
  suburb: string;
  state: string;
  postcode: string;
  followedId: string | null;
  properties: Property[];
  loggedSaleResults: MarketSaleResultRow[];
}) {
  const { open: openAigent } = useAigent();
  const [baseData, setBaseData] = useState<SuburbStats | null>(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [demographics, setDemographics] = useState<
    SuburbDemographics | undefined
  >();
  const [demoLoading, setDemoLoading] = useState(true);
  const [currentFollowId, setCurrentFollowId] = useState(followedId);
  const [isPending, startTransition] = useTransition();
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let cancelled = false;
    setBaseLoading(true);
    (async () => {
      try {
        const result = await getSuburbBasePlacesData(suburb, state, postcode, "");
        if (!cancelled) setBaseData(result);
      } catch (e) {
        console.error("[suburb-detail] base load error:", e);
      } finally {
        if (!cancelled) setBaseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suburb, state, postcode]);

  useEffect(() => {
    let cancelled = false;
    setDemoLoading(true);
    (async () => {
      try {
        const d = await getSuburbDemographicsData(postcode, suburb, state);
        if (!cancelled) setDemographics(d);
      } catch (e) {
        console.error("[suburb-detail] demographics error:", e);
      } finally {
        if (!cancelled) setDemoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postcode, suburb, state]);

  const communityPrices = useMemo(
    () => communitySaleResultsToPrices(loggedSaleResults),
    [loggedSaleResults],
  );

  const mergedData = useMemo((): SuburbStats | null => {
    if (!baseData) return null;
    const crime =
      state.toUpperCase() === "NSW"
        ? nswBocsarCrimePlaceholder(suburb)
        : undefined;
    return {
      ...baseData,
      prices: communityPrices,
      demographics,
      crime,
    };
  }, [baseData, communityPrices, demographics, state, suburb]);

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
      {mergedData && (
        <div className="md:hidden">
          <SuburbMapSection
            data={mergedData}
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

        {baseLoading && !mergedData ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
              Loading schools, transport, and nearby places…
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
        ) : mergedData ? (
          <div className="mt-6 space-y-6">
            <div className="hidden md:block">
              <SuburbMapSection
                data={mergedData}
                properties={props}
                hoveredId={hoveredPropertyId}
                onHover={setHoveredPropertyId}
                hoveredPlaceId={hoveredPlaceId}
                onHoverPlace={setHoveredPlaceId}
              />
            </div>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                data={mergedData}
                propCount={props.length}
                suburb={suburb}
                postcode={postcode}
                state={state}
                demoLoading={demoLoading}
                onAsk={openAigent}
              />
            </TabsContent>
            <TabsContent value="properties" className="mt-0">
              <PropertiesTab properties={props} hoveredId={hoveredPropertyId} onHover={setHoveredPropertyId} />
            </TabsContent>
            <TabsContent value="schools" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <SchoolsTab data={mergedData} />
              </div>
            </TabsContent>
            <TabsContent value="transport" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <TransportTab data={mergedData} />
              </div>
            </TabsContent>
            <TabsContent value="lifestyle" className="mt-0">
              <div className="h-[500px] overflow-y-auto overflow-x-hidden">
                <LifestyleTab data={mergedData} hoveredPlaceId={hoveredPlaceId} onHoverPlace={setHoveredPlaceId} />
              </div>
            </TabsContent>
            <TabsContent value="market" className="mt-0">
              <MarketTab loggedSales={loggedSaleResults} />
            </TabsContent>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[#9CA3AF]">Could not load suburb data. Try refreshing.</p>
        )}
      </Tabs>

      {mergedData?.sources && mergedData.sources.length > 0 && (
        <p className="text-xs text-[#9CA3AF]">
          Data sourced from {mergedData.sources.join(", ")}. Demographics may combine
          postcode lookup and suburbs.com.au (cached up to 7 days). Market figures
          come from your logged sale results. NSW crime links point to BOCSAR.
        </p>
      )}
    </div>
  );
}
