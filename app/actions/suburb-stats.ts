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

const CACHE_SECONDS = 86_400; // 24 hours

async function buildSuburbStats(
  address: string,
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

  // Step 1 — geocode the property address
  const loc = await geocodeAddress(address, suburb, state, postcode);
  if (loc) {
    stats.propertyLocation = loc;
    sources.push("Google Maps Geocoding API");
  }

  // Step 2 — parallel fetches for all data
  const domainPromise = fetchDomainProfile(suburb, state, postcode).catch(
    (e) => {
      console.warn("[suburb-stats] domain error:", e);
      return {} as Awaited<ReturnType<typeof fetchDomainProfile>>;
    },
  );

  const crimePromise = fetchCrimeData(suburb, state).catch((e) => {
    console.warn("[suburb-stats] crime error:", e);
    return undefined;
  });

  const placesPromises = loc
    ? Promise.all([
        fetchSchools(loc.lat, loc.lng).catch(() => []),
        fetchTransport(loc.lat, loc.lng).catch(
          () => ({}) as Awaited<ReturnType<typeof fetchTransport>>,
        ),
        fetchLifestyle(loc.lat, loc.lng).catch(
          () =>
            ({ cafes: 0, parks: 0, supermarkets: 0, restaurants: 0 }) as Awaited<
              ReturnType<typeof fetchLifestyle>
            >,
        ),
      ])
    : Promise.resolve([[], {}, { cafes: 0, parks: 0, supermarkets: 0, restaurants: 0 }] as const);

  const [domain, crime, [schools, transport, lifestyle]] = await Promise.all([
    domainPromise,
    crimePromise,
    placesPromises,
  ]);

  // Domain data
  if (domain.prices) {
    stats.prices = domain.prices;
    sources.push("Domain");
  }
  if (domain.demographics) {
    stats.demographics = domain.demographics;
    sources.push("ABS via Domain");
  }

  // Crime
  if (crime) {
    stats.crime = crime;
    sources.push("NSW Bureau of Crime Statistics");
  }

  // Places API data
  if (loc) {
    if (Array.isArray(schools) && schools.length > 0) {
      stats.schools = schools;
    }
    if (transport && typeof transport === "object" && Object.keys(transport).length > 0) {
      stats.transport = transport;
    }
    stats.lifestyle = lifestyle as Awaited<ReturnType<typeof fetchLifestyle>>;

    if (!sources.includes("Google Maps Places API")) {
      sources.push("Google Maps Places API");
    }
  }

  return stats;
}

const getCachedSuburbStats = unstable_cache(
  async (
    address: string,
    suburb: string,
    state: string,
    postcode: string,
  ): Promise<SuburbStats> => {
    return buildSuburbStats(address, suburb, state, postcode);
  },
  ["suburb-stats"],
  { revalidate: CACHE_SECONDS },
);

export async function getSuburbStats(
  address: string,
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbStats> {
  try {
    return await getCachedSuburbStats(address, suburb, state, postcode);
  } catch (e) {
    console.error("[suburb-stats] top-level error:", e);
    return {
      suburb,
      state,
      postcode,
      fetchedAt: new Date().toISOString(),
      sources: [],
    };
  }
}
