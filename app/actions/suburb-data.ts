"use server";

import { unstable_cache } from "next/cache";

import {
  fetchCrimeData,
  fetchDomainProfile,
  fetchLifestyle,
  fetchSchools,
  fetchTransport,
  geocodeAddress,
} from "@/lib/suburb-stats/fetchers";
import type { SuburbStats } from "@/lib/suburb-stats/types";

const CACHE_TTL = 86_400; // 24 hours

async function buildSuburbData(
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbStats> {
  const sources: string[] = [];
  const stats: SuburbStats = {
    suburb,
    state,
    postcode,
    fetchedAt: new Date().toISOString(),
    sources,
  };

  const loc = await geocodeAddress("", suburb, state, postcode);
  if (loc) {
    stats.propertyLocation = loc;
    sources.push("Google Maps Geocoding API");
  }

  const domainPromise = fetchDomainProfile(suburb, state, postcode).catch(
    () => ({}) as Awaited<ReturnType<typeof fetchDomainProfile>>,
  );

  const crimePromise = fetchCrimeData(suburb, state).catch(() => undefined);

  const placesPromises = loc
    ? Promise.all([
        fetchSchools(loc.lat, loc.lng).catch(() => []),
        fetchTransport(loc.lat, loc.lng).catch(
          () => ({}) as Awaited<ReturnType<typeof fetchTransport>>,
        ),
        fetchLifestyle(loc.lat, loc.lng).catch(
          () => ({ cafes: 0, parks: 0, supermarkets: 0, restaurants: 0 }),
        ),
      ])
    : Promise.resolve([
        [],
        {} as Awaited<ReturnType<typeof fetchTransport>>,
        { cafes: 0, parks: 0, supermarkets: 0, restaurants: 0 },
      ] as const);

  const [domain, crime, [schools, transport, lifestyle]] = await Promise.all([
    domainPromise,
    crimePromise,
    placesPromises,
  ]);

  if (domain.prices) {
    stats.prices = domain.prices;
    sources.push("Domain");
  }
  if (domain.demographics) {
    stats.demographics = domain.demographics;
    sources.push("ABS via Domain");
  }
  if (crime) {
    stats.crime = crime;
    sources.push("NSW Bureau of Crime Statistics");
  }
  if (loc) {
    if (Array.isArray(schools) && schools.length > 0) stats.schools = schools;
    if (transport && Object.keys(transport).length > 0) stats.transport = transport;
    stats.lifestyle = lifestyle as Awaited<ReturnType<typeof fetchLifestyle>>;
    if (!sources.includes("Google Maps Places API"))
      sources.push("Google Maps Places API");
  }

  return stats;
}

const getCachedSuburbData = unstable_cache(
  async (suburb: string, state: string, postcode: string) =>
    buildSuburbData(suburb, state, postcode),
  ["suburb-places-data"],
  { revalidate: CACHE_TTL },
);

export async function getSuburbPlacesData(
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbStats> {
  try {
    return await getCachedSuburbData(suburb, state, postcode);
  } catch (e) {
    console.error("[suburb-data] error:", e);
    return {
      suburb,
      state,
      postcode,
      fetchedAt: new Date().toISOString(),
      sources: [],
    };
  }
}
