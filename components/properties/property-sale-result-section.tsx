"use client";

import Link from "next/link";
import { useState } from "react";

import {
  LogSaleResultDialog,
  type SaleAgentOption,
  type SalePropertyOption,
} from "@/components/market/log-sale-result-dialog";
import type { MarketSaleResultRow } from "@/components/market/market-intelligence-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatAud } from "@/lib/utils";

type Props = {
  propertyId: string;
  status: string;
  listingPrice: number | null;
  results: MarketSaleResultRow[];
  agents: SaleAgentOption[];
  propertyOptions: SalePropertyOption[];
  address: string;
  suburb: string;
  postcode: string;
  bedrooms: number | null;
  propertyType: string | null;
};

function formatSaleDate(iso: string) {
  const t = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PropertySaleResultSection({
  propertyId,
  status,
  listingPrice,
  results,
  agents,
  propertyOptions,
  address,
  suburb,
  postcode,
  bedrooms,
  propertyType,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const primary = results[0];
  const showProminent =
    status === "purchased" || results.length > 0;

  let vsAsking: string | null = null;
  if (primary && listingPrice != null && listingPrice > 0) {
    const pct =
      ((primary.salePrice - listingPrice) / listingPrice) * 100;
    const r = Math.round(pct * 10) / 10;
    vsAsking = `${r >= 0 ? "+" : ""}${r}% vs listing guide`;
  }

  let vsReserve: string | null = null;
   if (
    primary &&
    primary.saleType === "auction" &&
    primary.reservePrice != null &&
    primary.reservePrice > 0
  ) {
    if (primary.passedIn) {
      vsReserve = "Passed in";
    } else {
      const pct =
        ((primary.salePrice - primary.reservePrice) / primary.reservePrice) *
        100;
      const r = Math.round(pct * 10) / 10;
      vsReserve = `${r >= 0 ? "+" : ""}${r}% vs reserve`;
    }
  }

  return (
    <>
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base text-[#111827]">Sale result</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#0D9488] text-[#0D9488] hover:bg-[#ECFDF5]"
            onClick={() => setDialogOpen(true)}
          >
            Log sale result
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showProminent && primary ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                Sold for{" "}
                <span className="text-lg tabular-nums">
                  {formatAud(primary.salePrice)}
                </span>{" "}
                on {formatSaleDate(primary.saleDate)}
                {primary.saleType === "auction"
                  ? " at auction"
                  : primary.saleType === "private_treaty"
                    ? " by private treaty"
                    : primary.saleType === "expression_of_interest"
                      ? " via expression of interest"
                      : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-emerald-800">
                {vsAsking ? (
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-medium">
                    {vsAsking}
                  </span>
                ) : null}
                {vsReserve ? (
                  <span
                    className={`rounded-md px-2 py-0.5 font-medium ${
                      vsReserve === "Passed in"
                        ? "bg-red-100 text-red-800"
                        : "bg-white/80 text-emerald-900"
                    }`}
                  >
                    {vsReserve}
                  </span>
                ) : null}
              </div>
              {primary.notes?.trim() ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-[#374151]">
                  {primary.notes}
                </p>
              ) : null}
            </div>
          ) : showProminent && !primary ? (
            <p className="text-sm text-[#6B7280]">
              This property is marked purchased — add a sale result to record
              the price and method for your market log.
            </p>
          ) : (
            <p className="text-sm text-[#6B7280]">
              Log a sale price to track this listing or nearby comparables in{" "}
              <Link href="/market" className="font-semibold text-[#0D9488] hover:underline">
                Market
              </Link>
              .
            </p>
          )}
          {results.length > 1 ? (
            <p className="text-xs text-[#9CA3AF]">
              {results.length} results linked — showing the most recent.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <LogSaleResultDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        propertyOptions={propertyOptions}
        lockedPropertyId={propertyId}
        defaults={{
          address,
          suburb,
          postcode,
          bedrooms,
          propertyType,
          propertyId,
        }}
      />
    </>
  );
}
