import { formatAud } from "@/lib/utils";

import type { SuburbPrices } from "./types";

/** Subset of sale result fields used for community market stats (client rows may use string dates). */
export type CommunitySaleResultLike = {
  salePrice: number;
  propertyType?: string | null;
  daysOnMarket?: number | null;
  saleType?: string | null;
  passedIn?: boolean;
};

const HOUSE_TYPES = new Set(["house", "townhouse"]);
const UNIT_TYPES = new Set(["unit", "apartment"]);

function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[m]
    : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Builds suburb price context from the signed-in user's logged sale results.
 */
export function communitySaleResultsToPrices(
  rows: CommunitySaleResultLike[],
): SuburbPrices | undefined {
  if (!rows.length) return undefined;

  const housePrices: number[] = [];
  const unitPrices: number[] = [];
  const allPrices: number[] = [];
  let domSum = 0;
  let domN = 0;
  let auctioned = 0;
  let soldUnderHammer = 0;

  for (const r of rows) {
    const p = r.salePrice;
    if (typeof p !== "number" || !Number.isFinite(p) || p <= 0) continue;
    allPrices.push(p);
    const pt = r.propertyType?.toLowerCase().trim();
    if (pt && HOUSE_TYPES.has(pt)) housePrices.push(p);
    else if (pt && UNIT_TYPES.has(pt)) unitPrices.push(p);

    if (r.daysOnMarket != null && r.daysOnMarket >= 0) {
      domSum += r.daysOnMarket;
      domN++;
    }
    if (r.saleType === "auction") {
      auctioned++;
      if (!r.passedIn) soldUnderHammer++;
    }
  }

  const prices: SuburbPrices = {};
  const mh = median(housePrices);
  const mu = median(unitPrices);
  const mo = median(allPrices);

  if (mh != null) prices.medianHouse = formatAud(mh);
  else if (mo != null) prices.medianHouse = formatAud(mo);

  if (mu != null) prices.medianUnit = formatAud(mu);

  if (domN > 0) {
    prices.daysOnMarket = `${Math.round(domSum / domN)} days`;
  }

  if (auctioned > 0) {
    const pct = (soldUnderHammer / auctioned) * 100;
    prices.auctionClearanceRate = `${Math.round(pct * 10) / 10}%`;
  }

  return Object.keys(prices).length ? prices : undefined;
}
