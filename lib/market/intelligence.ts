/** Row shape for stats (serialised or DB); `createdAt` not used. */
export type SaleIntelRow = {
  suburb: string;
  postcode: string;
  salePrice: number;
  saleDate: string;
  saleType: string | null;
  reservePrice: number | null;
  passedIn: boolean;
  daysOnMarket: number | null;
};

export function saleTypeLabel(t: string | null | undefined): string {
  if (t === "auction") return "Auction";
  if (t === "private_treaty") return "Private Treaty";
  if (t === "expression_of_interest") return "Expression of Interest";
  if (!t) return "—";
  return t.replace(/_/g, " ");
}

export function propertyTypeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type SuburbRollup = {
  key: string;
  suburb: string;
  postcode: string;
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  avgDaysOnMarket: number | null;
  auctionTotal: number;
  auctionCleared: number;
  /**0–1, null if no auctions */
  clearanceRate: number | null;
  prices: number[];
};

export type QuickStats = {
  resultCount: number;
  suburbCount: number;
  avgPctAboveReserve: number | null;
  mostTrackedSuburb: string | null;
};

export type MarketInsightLine = string;

function suburbLabel(r: SaleIntelRow) {
  return `${r.suburb} ${r.postcode}`;
}

export function computeQuickStats(rows: SaleIntelRow[]): QuickStats {
  if (rows.length === 0) {
    return {
      resultCount: 0,
      suburbCount: 0,
      avgPctAboveReserve: null,
      mostTrackedSuburb: null,
    };
  }

  const suburbKeys = new Set(rows.map((r) => `${r.suburb}\0${r.postcode}`));
  const reserveSamples = rows.filter(
    (r) =>
      r.saleType === "auction" &&
      r.reservePrice != null &&
      r.reservePrice > 0 &&
      !r.passedIn,
  );
  let avgPctAboveReserve: number | null = null;
  if (reserveSamples.length > 0) {
    const sum = reserveSamples.reduce((s, r) => {
      const pct =
        ((r.salePrice - (r.reservePrice as number)) / (r.reservePrice as number)) *
        100;
      return s + pct;
    }, 0);
    avgPctAboveReserve = Math.round((sum / reserveSamples.length) * 10) / 10;
  }

  const bySub = new Map<string, number>();
  for (const r of rows) {
    const k = suburbLabel(r);
    bySub.set(k, (bySub.get(k) ?? 0) + 1);
  }
  let mostTrackedSuburb: string | null = null;
  let best = 0;
  for (const [label, c] of Array.from(bySub.entries())) {
    if (c > best) {
      best = c;
      mostTrackedSuburb = label;
    }
  }

   return {
    resultCount: rows.length,
    suburbCount: suburbKeys.size,
    avgPctAboveReserve,
    mostTrackedSuburb,
  };
}

/** Union sale-result suburbs with saved/followed suburbs (e.g. from properties) for counts. */
export function computeQuickStatsWithTracked(
  rows: SaleIntelRow[],
  tracked: { suburb: string; postcode: string }[],
): QuickStats {
  const base = computeQuickStats(rows);
  const keySet = new Set<string>();
  for (const r of rows) keySet.add(`${r.suburb}\0${r.postcode}`);
  for (const t of tracked) {
    const sub = t.suburb?.trim();
    const pc = t.postcode?.trim();
    if (sub && pc) keySet.add(`${sub}\0${pc}`);
  }
  return { ...base, suburbCount: keySet.size };
}

export function computeSuburbRollups(rows: SaleIntelRow[]): SuburbRollup[] {
  const byKey = new Map<
    string,
    {
      suburb: string;
      postcode: string;
      prices: number[];
      doms: number[];
      auctionTotal: number;
      auctionCleared: number;
    }
  >();

  for (const r of rows) {
    const key = `${r.suburb}\0${r.postcode}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        suburb: r.suburb,
        postcode: r.postcode,
        prices: [],
        doms: [],
        auctionTotal: 0,
        auctionCleared: 0,
      });
    }
    const g = byKey.get(key)!;
    g.prices.push(r.salePrice);
    if (r.daysOnMarket != null && r.daysOnMarket >= 0) {
      g.doms.push(r.daysOnMarket);
    }
    if (r.saleType === "auction") {
      g.auctionTotal += 1;
      if (!r.passedIn) g.auctionCleared += 1;
    }
  }

  const out: SuburbRollup[] = [];
  for (const [, g] of Array.from(byKey.entries())) {
    if (g.prices.length < 2) continue;
    const sum = g.prices.reduce((a, b) => a + b, 0);
    const avgDom =
      g.doms.length === 0
        ? null
        : Math.round(g.doms.reduce((a, b) => a + b, 0) / g.doms.length);
    const clearanceRate =
      g.auctionTotal === 0 ? null : g.auctionCleared / g.auctionTotal;
    out.push({
      key: `${g.suburb}\0${g.postcode}`,
      suburb: g.suburb,
      postcode: g.postcode,
      count: g.prices.length,
      minPrice: Math.min(...g.prices),
      maxPrice: Math.max(...g.prices),
      avgPrice: Math.round(sum / g.prices.length),
      avgDaysOnMarket: avgDom,
      auctionTotal: g.auctionTotal,
      auctionCleared: g.auctionCleared,
      clearanceRate,
      prices: [...g.prices],
    });
  }

  out.sort((a, b) => b.count - a.count);
  return out;
}

/** Add tracked suburbs that have no logged sales yet (so Market shows suburbs from saved listings). */
export function mergeRollupsWithTrackedSuburbs(
  rollups: SuburbRollup[],
  tracked: { suburb: string; postcode: string }[],
): SuburbRollup[] {
  const keys = new Set(rollups.map((r) => r.key));
  const extra: SuburbRollup[] = [];
  for (const t of tracked) {
    const sub = t.suburb?.trim();
    const pc = t.postcode?.trim();
    if (!sub || !pc) continue;
    const key = `${sub}\0${pc}`;
    if (keys.has(key)) continue;
    keys.add(key);
    extra.push({
      key,
      suburb: sub,
      postcode: pc,
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      avgDaysOnMarket: null,
      auctionTotal: 0,
      auctionCleared: 0,
      clearanceRate: null,
      prices: [],
    });
  }
  const merged = [...rollups, ...extra];
  merged.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return `${a.suburb} ${a.postcode}`.localeCompare(
      `${b.suburb} ${b.postcode}`,
    );
  });
  return merged;
}

export function priceHistogramBins(prices: number[], bins = 5) {
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return [{ from: min, to: max, count: prices.length, pct: 100 }];
  }
  const step = (max - min) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const p of prices) {
    let i = Math.floor((p - min) / step);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    counts[i] += 1;
  }
  const total = prices.length;
  return counts.map((count, i) => ({
    from: Math.round(min + i * step),
    to: Math.round(min + (i + 1) * step),
    count,
    pct: Math.round((count / total) * 1000) / 10,
  }));
}

export function computeInsights(rows: SaleIntelRow[]): MarketInsightLine[] {
  const lines: MarketInsightLine[] = [];
  const rollups = computeSuburbRollups(rows);

  for (const r of rollups) {
    const label = r.suburb;
    const reserveRows = rows.filter(
      (x) =>
        x.suburb === r.suburb &&
        x.postcode === r.postcode &&
        x.saleType === "auction" &&
        x.reservePrice != null &&
        x.reservePrice > 0 &&
        !x.passedIn,
    );
    if (reserveRows.length >= 2) {
      const avgPct =
        reserveRows.reduce((s, x) => {
          const pct =
            ((x.salePrice - (x.reservePrice as number)) /
              (x.reservePrice as number)) *
            100;
          return s + pct;
        }, 0) / reserveRows.length;
      const rounded = Math.round(avgPct * 10) / 10;
      lines.push(
        `Properties in ${label} are selling ${rounded >= 0 ? "+" : ""}${rounded}% above reserve on average (from your ${reserveRows.length} logged results with reserve).`,
      );
    }

    if (r.avgDaysOnMarket != null && r.count >= 2) {
      lines.push(
        `Average days on market in ${label}: ${r.avgDaysOnMarket} days (from ${r.count} results).`,
      );
    }

    if (r.auctionTotal >= 2 && r.clearanceRate != null) {
      const cleared = r.auctionCleared;
      const tot = r.auctionTotal;
      lines.push(
        `${cleared} of ${tot} auctions in ${label} cleared (${Math.round(r.clearanceRate * 100)}% in your log).`,
      );
    }
  }

  const globalReserve = rows.filter(
    (x) =>
      x.saleType === "auction" &&
      x.reservePrice != null &&
      x.reservePrice > 0 &&
      !x.passedIn,
  );
  if (globalReserve.length >= 3 && lines.length === 0) {
    const avgPct =
      globalReserve.reduce((s, x) => {
        const pct =
          ((x.salePrice - (x.reservePrice as number)) /
            (x.reservePrice as number)) *
          100;
        return s + pct;
      }, 0) / globalReserve.length;
    const rounded = Math.round(avgPct * 10) / 10;
    lines.push(
      `Across your tracked auctions with reserve data, sale prices average ${rounded >= 0 ? "+" : ""}${rounded}% vs reserve.`,
    );
  }

  return lines.slice(0, 8);
}
