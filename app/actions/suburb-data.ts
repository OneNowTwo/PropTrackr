"use server";

import { unstable_cache } from "next/cache";

import {
  fetchClaudeAbsDemographics,
  fetchClaudeBocsarCrime,
  fetchClaudeDomainMarket,
} from "@/lib/suburb-stats/claude-suburb";
import {
  fetchLifestyle,
  fetchSchools,
  fetchTransport,
  geocodeAddress,
} from "@/lib/suburb-stats/fetchers";
import type { SuburbStats } from "@/lib/suburb-stats/types";

const CACHE_TTL_OUTER = 86_400; // 24 hours — full bundle refresh

export const getSuburbMarketClaudeCached = unstable_cache(
  async (suburb: string, state: string, postcode: string) =>
    fetchClaudeDomainMarket(suburb, state, postcode),
  ["suburb-claude-market-v2"],
  { revalidate: 86_400 },
);

export const getSuburbDemographicsClaudeCached = unstable_cache(
  async (postcode: string, suburb: string, state: string) =>
    fetchClaudeAbsDemographics(postcode, suburb, state),
  ["suburb-claude-demographics-v2"],
  { revalidate: 604_800 },
);

export const getSuburbCrimeClaudeCached = unstable_cache(
  async (suburb: string, state: string) =>
    fetchClaudeBocsarCrime(suburb, state),
  ["suburb-claude-crime-v2"],
  { revalidate: 604_800 },
);

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

  const marketPromise = getSuburbMarketClaudeCached(
    suburb,
    state,
    postcode,
  ).catch(() => undefined);

  const demographicsPromise = getSuburbDemographicsClaudeCached(
    postcode,
    suburb,
    state,
  ).catch(() => undefined);

  const crimePromise = getSuburbCrimeClaudeCached(suburb, state).catch(
    () => undefined,
  );

  const placesPromises = loc
    ? Promise.all([
        fetchSchools(loc.lat, loc.lng).catch(() => []),
        fetchTransport(loc.lat, loc.lng).catch(
          () => ({}) as Awaited<ReturnType<typeof fetchTransport>>,
        ),
        fetchLifestyle(loc.lat, loc.lng).catch(
          () => ({ cafes: [], parks: [], supermarkets: [], restaurants: [] }),
        ),
      ])
    : Promise.resolve([
        [],
        {} as Awaited<ReturnType<typeof fetchTransport>>,
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
    if (Array.isArray(schools) && schools.length > 0) stats.schools = schools;
    if (transport && Object.keys(transport).length > 0)
      stats.transport = transport;
    stats.lifestyle = lifestyle as Awaited<ReturnType<typeof fetchLifestyle>>;
    if (!sources.includes("Google Maps Places API"))
      sources.push("Google Maps Places API");
  }

  return stats;
}

const getCachedSuburbData = unstable_cache(
  async (suburb: string, state: string, postcode: string) =>
    buildSuburbData(suburb, state, postcode),
  ["suburb-places-data-v2"],
  { revalidate: CACHE_TTL_OUTER },
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
