"use client";

import { FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteSaleResult } from "@/app/actions/price-tracking";
import {
  LogSaleResultDialog,
  type SaleAgentOption,
  type SalePropertyOption,
} from "@/components/market/log-sale-result-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaleResultWithAgent } from "@/lib/db/sale-results-queries";
import {
  computeInsights,
  computeQuickStats,
  computeSuburbRollups,
  priceHistogramBins,
  propertyTypeLabel,
  saleTypeLabel,
} from "@/lib/market/intelligence";
import { cn, formatAud } from "@/lib/utils";

export type MarketSaleResultRow = Omit<
  SaleResultWithAgent,
  "createdAt"
> & { createdAt: string };

type Row = MarketSaleResultRow;

function parseSaleDate(s: string) {
  const t = Date.parse(`${s}T12:00:00`);
  return Number.isNaN(t) ? new Date() : new Date(t);
}

function formatRowDate(s: string) {
  return parseSaleDate(s).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeBedLine(r: Row) {
  const t = propertyTypeLabel(r.propertyType);
  const b =
    r.bedrooms != null ? `${r.bedrooms} bed` : null;
  if (t === "—" && !b) return "—";
  if (t === "—") return b ?? "—";
  if (!b) return t;
  return `${t} · ${b}`;
}

export function MarketIntelligenceClient({
  initialResults,
  agents,
  propertyOptions,
}: {
  initialResults: MarketSaleResultRow[];
  agents: SaleAgentOption[];
  propertyOptions: SalePropertyOption[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const results = initialResults;
  const stats = useMemo(() => computeQuickStats(results), [results]);
  const rollups = useMemo(() => computeSuburbRollups(results), [results]);
  const insights = useMemo(() => computeInsights(results), [results]);

  async function onDelete(id: string) {
    setDeletingId(id);
    const res = await deleteSaleResult(id);
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  function reserveLine(r: Row) {
    if (r.saleType !== "auction") return null;
    if (r.passedIn) {
      return (
        <span className="font-semibold text-red-600">Passed in</span>
      );
    }
    if (r.reservePrice != null && r.reservePrice > 0) {
      const pct =
        ((r.salePrice - r.reservePrice) / r.reservePrice) * 100;
      const rounded = Math.round(pct * 10) / 10;
      const pos = rounded >= 0;
      return (
        <span
          className={cn(
            "font-semibold tabular-nums",
            pos ? "text-emerald-600" : "text-amber-700",
          )}
        >
          {pos ? "+" : ""}
          {rounded}% vs reserve
        </span>
      );
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24 md:pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          My market intelligence
        </h1>
        <p className="text-[#6B7280]">
          Track sale results to build your own picture of the market
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="bg-[#0D9488] text-white hover:bg-[#0F766E]"
          onClick={() => setDialogOpen(true)}
        >
          + Log sale result
        </Button>
      </div>

      <LogSaleResultDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        propertyOptions={propertyOptions}
      />

      {results.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#E5E7EB] shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Properties tracked
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#111827]">
                {stats.resultCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Suburbs tracked
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#111827]">
                {stats.suburbCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Avg sale vs reserve
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                {stats.avgPctAboveReserve != null
                  ? `${stats.avgPctAboveReserve >= 0 ? "+" : ""}${stats.avgPctAboveReserve}%`
                  : "—"}
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Cleared auctions with reserve only
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB] shadow-sm">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Most tracked suburb
              </p>
              <p className="mt-1 text-lg font-bold text-[#111827]">
                {stats.mostTrackedSuburb ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {insights.length > 0 ? (
        <Card className="border-[#E5E7EB] bg-[#FAFAFA] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#111827]">Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-[#374151]">
              {insights.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[#0D9488]" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#111827]">Logged results</h2>
        {results.length === 0 ? (
          <Card className="border-dashed border-[#E5E7EB]">
            <CardContent className="py-10 text-center text-sm text-[#6B7280]">
              No sale results yet. Log a sale to start building your dataset.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white shadow-sm md:block">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Suburb</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Sale</th>
                    <th className="px-4 py-3">DOM</th>
                    <th className="px-4 py-3">vs Reserve</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.id}
                      className="group border-b border-[#F3F4F6] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-[#111827]">
                        <span className="line-clamp-2">
                          {r.address?.trim() || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {r.suburb} {r.postcode}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {typeBedLine(r)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base font-bold text-emerald-600 tabular-nums">
                          {formatAud(r.salePrice)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                          {saleTypeLabel(r.saleType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#6B7280]">
                        {r.daysOnMarket != null ? r.daysOnMarket : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{reserveLine(r)}</td>
                      <td className="px-4 py-3 text-[#6B7280] tabular-nums">
                        {formatRowDate(r.saleDate)}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          {r.agentName ?? "—"}
                          {r.notes?.trim() ? (
                            <FileText
                              className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]"
                              aria-label="Has notes"
                            />
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded-md p-1.5 text-[#D1D5DB] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="group relative rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="absolute right-3 top-3 rounded-md p-1 text-[#D1D5DB] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <p className="pr-10 font-semibold text-[#111827]">
                    {r.address?.trim() || "—"}
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    {r.suburb} {r.postcode}
                  </p>
                  <p className="mt-2 text-sm text-[#6B7280]">{typeBedLine(r)}</p>
                  <p className="mt-2 text-xl font-bold text-emerald-600 tabular-nums">
                    {formatAud(r.salePrice)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                      {saleTypeLabel(r.saleType)}
                    </span>
                    {r.daysOnMarket != null ? (
                      <span className="text-[#6B7280]">
                        {r.daysOnMarket} DOM
                      </span>
                    ) : null}
                    {reserveLine(r)}
                    {r.notes?.trim() ? (
                      <FileText className="h-4 w-4 text-[#9CA3AF]" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-[#9CA3AF]">
                    {formatRowDate(r.saleDate)}
                    {r.agentName ? ` · ${r.agentName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {rollups.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#111827]">
            Suburb analysis
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {rollups.map((u) => {
              const bins = priceHistogramBins(u.prices, 5);
              return (
                <Card key={u.key} className="border-[#E5E7EB] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#111827]">
                      {u.suburb} {u.postcode}
                    </CardTitle>
                    <p className="text-xs text-[#6B7280]">
                      {u.count} results logged
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[#374151]">
                      <span>
                        Range:{" "}
                        <strong className="tabular-nums text-[#111827]">
                          {formatAud(u.minPrice)} – {formatAud(u.maxPrice)}
                        </strong>
                      </span>
                      <span>
                        Average:{" "}
                        <strong className="tabular-nums text-[#111827]">
                          {formatAud(u.avgPrice)}
                        </strong>
                      </span>
                    </div>
                    <p className="text-[#6B7280]">
                      Avg days on market:{" "}
                      <span className="font-semibold text-[#111827]">
                        {u.avgDaysOnMarket != null ? `${u.avgDaysOnMarket} days` : "—"}
                      </span>
                    </p>
                    <p className="text-[#6B7280]">
                      Auction clearance (your log):{" "}
                      <span className="font-semibold text-[#111827]">
                        {u.auctionTotal === 0
                          ? "—"
                          : `${Math.round((u.clearanceRate ?? 0) * 100)}% (${u.auctionCleared}/${u.auctionTotal})`}
                      </span>
                    </p>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        Price distribution
                      </p>
                      <div className="flex h-8 w-full gap-px overflow-hidden rounded-md bg-[#E5E7EB]">
                        {bins.map((b, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 items-center justify-center bg-[#0D9488]/85 text-[10px] font-bold text-white"
                            style={{
                              width:
                                u.count > 0
                                  ? `${(b.count / u.count) * 100}%`
                                  : "0%",
                            }}
                            title={`${formatAud(b.from)}–${formatAud(b.to)}: ${b.count} sales`}
                          >
                            {b.count > 0 && b.count / u.count >= 0.15
                              ? b.count
                              : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
