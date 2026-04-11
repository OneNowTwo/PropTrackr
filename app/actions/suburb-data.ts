"use server";

import { unstable_cache } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { fetchSaleResultsForSuburb } from "@/lib/db/sale-results-queries";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { fetchSuburbDemographicsCombined } from "@/lib/suburb-stats/claude-suburb";
import { communitySaleResultsToPrices } from "@/lib/suburb-stats/community-market";
import {
  fetchLifestyle,
  fetchSchools,
  fetchTransport,
  geocodeAddress,
} from "@/lib/suburb-stats/fetchers";
import type { SuburbDemographics, SuburbStats } from "@/lib/suburb-stats/types";

const CACHE_TTL_OUTER = 86_400;

async function resolveDbUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row?.id ?? null;
}

export const getSuburbDemographicsCached = unstable_cache(
  async (postcode: string, suburb: string, state: string) =>
    fetchSuburbDemographicsCombined(postcode, suburb, state),
  ["suburb-demographics-v3-postcodes-suburbscom"],
  { revalidate: 604_800 },
);

export async function getSuburbDemographicsData(
  postcode: string,
  suburb: string,
  state: string,
): Promise<SuburbDemographics | undefined> {
  try {
    return await getSuburbDemographicsCached(postcode, suburb, state);
  } catch (e) {
    console.error("[suburb-data] demographics error:", e);
    return undefined;
  }
}

/**
 * Logged sale results for this suburb → price context (per signed-in user). Not cached.
 */
export async function getSuburbCommunityMarketData(
  suburb: string,
  state: string,
  postcode: string,
) {
  void state;
  const dbUserId = await resolveDbUserId();
  if (!dbUserId) return undefined;
  const rows = await fetchSaleResultsForSuburb(dbUserId, suburb.trim(), postcode.trim());
  return communitySaleResultsToPrices(rows);
}

async function buildSuburbBasePlacesOnly(
  addressForGeocode: string,
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

  const loc = await geocodeAddress(
    addressForGeocode,
    suburb,
    state,
    postcode,
  );
  if (loc) {
    stats.propertyLocation = loc;
    sources.push("Google Maps Geocoding API");
  }

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

  const [schools, transport, lifestyle] = await placesPromises;

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

const getCachedSuburbBasePlaces = unstable_cache(
  async (
    addressForGeocode: string,
    suburb: string,
    state: string,
    postcode: string,
  ) => buildSuburbBasePlacesOnly(addressForGeocode, suburb, state, postcode),
  ["suburb-base-places-v3"],
  { revalidate: CACHE_TTL_OUTER },
);

export async function getSuburbBasePlacesData(
  suburb: string,
  state: string,
  postcode: string,
  addressForGeocode = "",
): Promise<SuburbStats> {
  try {
    return await getCachedSuburbBasePlaces(
      addressForGeocode,
      suburb,
      state,
      postcode,
    );
  } catch (e) {
    console.error("[suburb-data] base places error:", e);
    return {
      suburb,
      state,
      postcode,
      fetchedAt: new Date().toISOString(),
      sources: [],
    };
  }
}

/** @deprecated Use getSuburbBasePlacesData + section actions. */
export async function getSuburbPlacesData(
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbStats> {
  return getSuburbBasePlacesData(suburb, state, postcode, "");
}
