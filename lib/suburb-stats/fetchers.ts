import { fetchTextViaJina } from "@/lib/discovery/jina";
import type {
  NearbyPlace,
  SuburbCrime,
  SuburbDemographics,
  SuburbLifestyle,
  SuburbPrices,
  SuburbSchool,
  SuburbTransport,
} from "./types";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const PLACES_TIMEOUT = 8_000;

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export async function geocodeAddress(
  address: string,
  suburb: string,
  state: string,
  postcode: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null;
  const q = [address, suburb, state, postcode, "Australia"]
    .filter(Boolean)
    .join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${MAPS_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PLACES_TIMEOUT) });
    const json = await res.json();
    const loc = json.results?.[0]?.geometry?.location;
    if (loc?.lat && loc?.lng) return { lat: loc.lat, lng: loc.lng };
  } catch (e) {
    console.warn("[suburb-stats] geocode failed:", e);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Google Maps Places — Nearby Search (legacy)
// ---------------------------------------------------------------------------

interface PlacesResult {
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  types?: string[];
  place_id?: string;
  opening_hours?: { open_now?: boolean };
  price_level?: number;
  photos?: Array<{ photo_reference: string; width: number; height: number }>;
}

function placePhotoUrl(photoRef: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${MAPS_KEY}`;
}

async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radius: number,
  type: string,
): Promise<PlacesResult[]> {
  if (!MAPS_KEY) return [];
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=${radius}&type=${type}&key=${MAPS_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PLACES_TIMEOUT) });
    const json = await res.json();
    if (json.status === "OK" || json.status === "ZERO_RESULTS") {
      return json.results ?? [];
    }
    console.warn("[suburb-stats] places error:", json.status, json.error_message);
  } catch (e) {
    console.warn("[suburb-stats] places fetch failed:", type, e);
  }
  return [];
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function toNearbyPlace(
  p: PlacesResult,
  originLat: number,
  originLng: number,
): NearbyPlace {
  const loc = p.geometry?.location;
  const firstPhotoRef = p.photos?.[0]?.photo_reference;
  return {
    name: p.name,
    vicinity: p.vicinity,
    rating: p.rating,
    userRatingsTotal: p.user_ratings_total,
    distanceMeters: loc
      ? distanceMeters(originLat, originLng, loc.lat, loc.lng)
      : undefined,
    types: p.types,
    placeId: p.place_id,
    openNow: p.opening_hours?.open_now,
    priceLevel: p.price_level,
    photoUrl: firstPhotoRef ? placePhotoUrl(firstPhotoRef) : undefined,
    lat: loc?.lat,
    lng: loc?.lng,
  };
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

function inferSchoolLevel(
  name: string,
  types?: string[],
): SuburbSchool["level"] {
  const lower = name.toLowerCase();
  if (/\bhigh\b|\bsecondary\b|\bcollegiate\b/.test(lower)) return "secondary";
  if (/\bprimary\b|\binfants\b|\bprep\b|\bjunior\b/.test(lower))
    return "primary";
  if (/\bk.?12\b|\bcollege\b|\bgrammar\b/.test(lower)) return "combined";
  if (types?.includes("secondary_school")) return "secondary";
  if (types?.includes("primary_school")) return "primary";
  return "unknown";
}

export async function fetchSchools(
  lat: number,
  lng: number,
): Promise<SuburbSchool[]> {
  const results = await fetchNearbyPlaces(lat, lng, 2000, "school");
  return results
    .map((r): SuburbSchool => {
      const base = toNearbyPlace(r, lat, lng);
      return { ...base, level: inferSchoolLevel(r.name, r.types) };
    })
    .sort((a, b) => (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999))
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export async function fetchTransport(
  lat: number,
  lng: number,
): Promise<SuburbTransport> {
  const [trains, buses] = await Promise.all([
    fetchNearbyPlaces(lat, lng, 3000, "train_station"),
    fetchNearbyPlaces(lat, lng, 1000, "bus_station"),
  ]);

  const trainStations = trains
    .map((r) => toNearbyPlace(r, lat, lng))
    .sort((a, b) => (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999))
    .slice(0, 5);

  return {
    nearestStation: trainStations[0] ?? undefined,
    trainStations: trainStations.length > 0 ? trainStations : undefined,
    busStops: buses.length,
  };
}

// ---------------------------------------------------------------------------
// Lifestyle
// ---------------------------------------------------------------------------

function toSortedPlaces(
  results: PlacesResult[],
  originLat: number,
  originLng: number,
  limit = 10,
): NearbyPlace[] {
  return results
    .map((r) => toNearbyPlace(r, originLat, originLng))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

export async function fetchLifestyle(
  lat: number,
  lng: number,
): Promise<SuburbLifestyle> {
  const [cafes, parks, supermarkets, restaurants] = await Promise.all([
    fetchNearbyPlaces(lat, lng, 500, "cafe"),
    fetchNearbyPlaces(lat, lng, 1000, "park"),
    fetchNearbyPlaces(lat, lng, 1000, "supermarket"),
    fetchNearbyPlaces(lat, lng, 500, "restaurant"),
  ]);

  return {
    cafes: toSortedPlaces(cafes, lat, lng),
    parks: toSortedPlaces(parks, lat, lng),
    supermarkets: toSortedPlaces(supermarkets, lat, lng),
    restaurants: toSortedPlaces(restaurants, lat, lng),
  };
}

// ---------------------------------------------------------------------------
// Domain suburb profile (via Jina) → prices + demographics
// ---------------------------------------------------------------------------

function suburbSlug(suburb: string): string {
  return suburb.toLowerCase().replace(/\s+/g, "-");
}

function extractDollarAmount(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  if (!m) return undefined;
  const raw = m[1] ?? m[0];
  const cleaned = raw.replace(/[^$0-9,.kKmM]/g, "");
  return cleaned || undefined;
}

function extractPercentage(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  if (!m) return undefined;
  return (m[1] ?? m[0]).trim();
}

function extractNumber(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  if (!m) return undefined;
  return (m[1] ?? m[0]).trim();
}

export async function fetchDomainProfile(
  suburb: string,
  state: string,
  postcode: string,
): Promise<{ prices?: SuburbPrices; demographics?: SuburbDemographics }> {
  const slug = suburbSlug(suburb);
  const st = state.toLowerCase();
  const url = `https://www.domain.com.au/suburb-profile/${slug}-${st}-${postcode}`;

  const result = await fetchTextViaJina(url);
  if (!result.ok || !result.text) {
    console.warn("[suburb-stats] domain profile fetch failed:", url);
    return {};
  }

  const t = result.text;

  const prices: SuburbPrices = {};
  const demographics: SuburbDemographics = {};

  // --- Prices ---
  prices.medianHouse = extractDollarAmount(
    t,
    /median\s+(?:sold\s+)?(?:house|property)\s+price[^$]*(\$[\d,.]+[kKmM]?)/i,
  );
  if (!prices.medianHouse) {
    prices.medianHouse = extractDollarAmount(
      t,
      /house[s]?\s*(?:median|price)[^$]{0,40}(\$[\d,.]+[kKmM]?)/i,
    );
  }

  prices.medianUnit = extractDollarAmount(
    t,
    /median\s+(?:sold\s+)?(?:unit|apartment)\s+price[^$]*(\$[\d,.]+[kKmM]?)/i,
  );
  if (!prices.medianUnit) {
    prices.medianUnit = extractDollarAmount(
      t,
      /unit[s]?\s*(?:median|price)[^$]{0,40}(\$[\d,.]+[kKmM]?)/i,
    );
  }

  prices.annualGrowthHouse = extractPercentage(
    t,
    /house[s]?[^%]{0,80}(-?[\d.]+%)/i,
  );
  prices.annualGrowthUnit = extractPercentage(
    t,
    /unit[s]?[^%]{0,80}(-?[\d.]+%)/i,
  );
  prices.daysOnMarket = extractNumber(
    t,
    /days?\s+on\s+market[^0-9]{0,20}(\d+)/i,
  );
  prices.auctionClearanceRate = extractPercentage(
    t,
    /auction\s+clearance[^%]{0,30}([\d.]+%)/i,
  );

  // --- Demographics ---
  demographics.medianAge = extractNumber(t, /median\s+age[^0-9]{0,20}(\d+)/i);
  demographics.medianIncome = extractDollarAmount(
    t,
    /median\s+(?:household\s+)?income[^$]{0,30}(\$[\d,.]+[kKmM]?)/i,
  );

  const ownerMatch = t.match(
    /(?:owner[- ]?occupi(?:ed|ers?)|own(?:ers?)?)[^0-9%]{0,30}([\d.]+%?)/i,
  );
  if (ownerMatch) demographics.ownerRatio = ownerMatch[1].trim();

  const renterMatch = t.match(
    /rent(?:ers?|ing|ed)[^0-9%]{0,30}([\d.]+%?)/i,
  );
  if (renterMatch) demographics.renterRatio = renterMatch[1].trim();

  const occupationBlock = t.match(
    /(?:top\s+)?occupation[s]?[:\s]*([^\n]{10,200})/i,
  );
  if (occupationBlock) {
    demographics.topOccupations = occupationBlock[1]
      .split(/[,;•|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
      .slice(0, 5);
  }

  const hasPrices = Object.values(prices).some(Boolean);
  const hasDemographics = Object.values(demographics).some(Boolean);

  return {
    prices: hasPrices ? prices : undefined,
    demographics: hasDemographics ? demographics : undefined,
  };
}

// ---------------------------------------------------------------------------
// Crime (BOCSAR via Jina) — best effort
// ---------------------------------------------------------------------------

export async function fetchCrimeData(
  suburb: string,
  state: string,
): Promise<SuburbCrime | undefined> {
  if (state.toUpperCase() !== "NSW") return undefined;

  const url = `https://www.bocsar.nsw.gov.au/Pages/bocsar_crime_stats/bocsar_locality_quickview.aspx?Ession=Suburb&Ession2=${encodeURIComponent(suburb)}`;
  const result = await fetchTextViaJina(url);
  if (!result.ok || !result.text) {
    console.warn("[suburb-stats] BOCSAR fetch failed for:", suburb);
    return undefined;
  }

  const t = result.text;
  const categories: SuburbCrime["categories"] = [];

  const crimePatterns = [
    /assault[^0-9]{0,30}([\d,.]+)/gi,
    /break\s+and\s+enter[^0-9]{0,30}([\d,.]+)/gi,
    /theft[^0-9]{0,30}([\d,.]+)/gi,
    /robbery[^0-9]{0,30}([\d,.]+)/gi,
    /malicious\s+damage[^0-9]{0,30}([\d,.]+)/gi,
    /drug[^0-9]{0,30}([\d,.]+)/gi,
  ];

  const crimeNames = [
    "Assault",
    "Break and Enter",
    "Theft",
    "Robbery",
    "Malicious Damage",
    "Drug Offences",
  ];

  for (let i = 0; i < crimePatterns.length; i++) {
    const m = crimePatterns[i].exec(t);
    if (m) {
      categories.push({ name: crimeNames[i], rate: m[1] });
    }
  }

  let level: SuburbCrime["level"];
  if (categories.length === 0) {
    level = undefined;
  } else {
    const total = categories.reduce(
      (sum, c) => sum + parseFloat(c.rate.replace(/,/g, "")) || 0,
      0,
    );
    level = total < 200 ? "Low" : total < 800 ? "Medium" : "High";
  }

  if (!level && categories.length === 0) return undefined;

  return { level, categories: categories.slice(0, 6) };
}
