import type { PlannerInspectionRow } from "@/lib/db/queries";
import type { Property } from "@/types/property";

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rough urban drive time from straight-line km (detour factor + ~35 km/h). */
export function estimateDriveMinutesFromStraightLineKm(km: number): number {
  const roadKm = km * 1.35;
  const hours = roadKm / 35;
  return Math.max(1, Math.round(hours * 60));
}

export function buildFullAddress(p: {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}): string {
  const tail = [p.state, p.postcode].filter(Boolean).join(" ");
  const mid = [p.suburb, tail].filter(Boolean).join(", ");
  return [p.address, mid, "Australia"].filter(Boolean).join(", ");
}

type StopSeed = {
  inspectionId: string;
  propertyId: string;
  addressLine: string;
  inspectionTime: string;
  inspectionTimestamp: number;
  lat: number;
  lng: number;
};

/**
 * Start from earliest inspection by time; repeatedly pick the geographically
 * nearest among remaining stops that are still at or after the current time.
 */
export function orderStopsTimeThenNearest(stops: StopSeed[]): StopSeed[] {
  if (stops.length <= 1) return stops;
  const timeSorted = [...stops].sort(
    (a, b) => a.inspectionTimestamp - b.inspectionTimestamp,
  );
  const out: StopSeed[] = [];
  let pool = timeSorted.slice();
  let current = pool.shift()!;
  out.push(current);
  while (pool.length) {
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]!;
      if (p.inspectionTimestamp < current.inspectionTimestamp) continue;
      const d = haversineKm(current.lat, current.lng, p.lat, p.lng);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) {
      pool.sort((a, b) => a.inspectionTimestamp - b.inspectionTimestamp);
      out.push(...pool);
      break;
    }
    const [best] = pool.splice(bestIdx, 1);
    out.push(best);
    current = best;
  }
  return out;
}

export function googleMapsDirUrl(addresses: string[]): string {
  if (addresses.length === 0) return "https://www.google.com/maps";
  const parts = addresses.map((a) => encodeURIComponent(a.trim()));
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}

export function propertyByIdMap(
  properties: Property[],
): Map<string, Property> {
  const m = new Map<string, Property>();
  for (const p of properties) m.set(p.id, p);
  return m;
}

export function inspectionRowsToSeeds(
  rows: PlannerInspectionRow[],
  propMap: Map<string, Property>,
  coords: Map<string, { lat: number; lng: number }>,
): StopSeed[] {
  const seeds: StopSeed[] = [];
  for (const row of rows) {
    const p = propMap.get(row.propertyId);
    const ll = coords.get(row.propertyId);
    if (!p || !ll) continue;
    seeds.push({
      inspectionId: row.id,
      propertyId: row.propertyId,
      addressLine: buildFullAddress(p),
      inspectionTime: row.inspectionTime,
      inspectionTimestamp: (() => {
        const day = new Date(row.inspectionDate).getTime();
        const [hRaw, mRaw] = row.inspectionTime.split(":");
        const h = Number.parseInt(hRaw ?? "0", 10) || 0;
        const m = Number.parseInt(mRaw ?? "0", 10) || 0;
        return day + (h * 60 + m) * 60 * 1000;
      })(),
      lat: ll.lat,
      lng: ll.lng,
    });
  }
  return seeds;
}
