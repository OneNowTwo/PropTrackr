"use server";

import { getSuburbBasePlacesData } from "@/app/actions/suburb-data";
import type { SuburbStats } from "@/lib/suburb-stats/types";

/**
 * Schools, transport, lifestyle, and geocoding only (fast).
 * Market, demographics, and crime load separately on the client.
 */
export async function getSuburbStats(
  address: string,
  suburb: string,
  state: string,
  postcode: string,
): Promise<SuburbStats> {
  return getSuburbBasePlacesData(suburb, state, postcode, address);
}
