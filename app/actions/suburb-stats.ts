"use server";

import { unstable_cache } from "next/cache";

import {
  getSuburbCrimeClaudeCached,
  getSuburbDemographicsClaudeCached,
  getSuburbMarketClaudeCached,
} from "@/app/actions/suburb-data";
import {
  fetchLifestyle,
  fetchSchools,
  fetchTransport,
  geocodeAddress,
} from "@/lib/suburb-stats/fetchers";
import type { SuburbStats } from "@/lib/suburb-stats/types";

const CACHE_SECONDS = 86_400; // 24 hours outer bundle

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

  const loc = await geocodeAddress(address, suburb, state, postcode);
  if (loc) {
    stats.propertyLocation = loc;
    sources.push("Google Maps Geocoding API");
  }

  const marketPromise = getSuburbMarketClaudeCached(
    suburb,
    state,
    postcode,
  ).catch((e) => {
    console.warn("[suburb-stats] market claude error:", e);
    return undefined;
  });

  const demographicsPromise = getSuburbDemographicsClaudeCached(
    postcode,
    suburb,
    state,
  ).catch((e) => {
    console.warn("[suburb-stats] demographics claude error:", e);
    return undefined;
  });

  const crimePromise = getSuburbCrimeClaudeCached(suburb, state).catch((e) => {
    console.warn("[suburb-stats] crime claude error:", e);
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
            ({
              cafes: [],
              parks: [],
              supermarkets: [],
              restaurants: [],
            }) as Awaited<ReturnType<typeof fetchLifestyle>>,
        ),
      ])
    : Promise.resolve([
        [],
        {},
        { cafes: [], parks: [], supermarkets: [], restaurants: [] },
      ] as const);

  const [market, demographics, crime, [schools, transport, lifestyle]] =
    await Promise.all([
      marketPromise,
      demographicsPromise,
      crimePromise,
      placesPromises,
    ]);

  if (market) {
    stats.prices = market;
    sources.push("Domain via Jina + Claude");
  }
  if (demographics) {
    stats.demographics = demographics;
    sources.push("ABS Census via Jina + Claude");
  }
  if (crime) {
    stats.crime = crime;
    sources.push("NSW BOCSAR via Jina + Claude");
  }

  if (loc) {
    if (Array.isArray(schools) && schools.length > 0) {
      stats.schools = schools;
    }
    if (
      transport &&
      typeof transport === "object" &&
      Object.keys(transport).length > 0
    ) {
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
  ["suburb-stats-v2"],
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
