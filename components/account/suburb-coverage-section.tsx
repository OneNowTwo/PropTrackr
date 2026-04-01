"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { refreshSuburbAgencyCoverage } from "@/app/actions/suburb-coverage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SuburbAgencyUrlRow } from "@/lib/db/queries";
import { formatSuburbPreferenceDisplay } from "@/lib/suburb-preferences";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

type Props = {
  preferenceSuburbs: string[];
  rows: SuburbAgencyUrlRow[];
};

function formatScraped(d: Date | null | undefined): string {
  if (!d) return "Never scraped";
  return d.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SuburbCoverageSection({ preferenceSuburbs, rows }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingSuburb, setPendingSuburb] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bySuburb = new Map<string, SuburbAgencyUrlRow[]>();
  for (const r of rows) {
    const list = bySuburb.get(r.suburb) ?? [];
    list.push(r);
    bySuburb.set(r.suburb, list);
  }

  function onRefresh(suburb: string) {
    setError(null);
    setPendingSuburb(suburb);
    startTransition(async () => {
      const result = await refreshSuburbAgencyCoverage(suburb);
      setPendingSuburb(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">Coverage</CardTitle>
        <p className="text-sm text-[#6B7280]">
          Agency listing pages we use to discover new properties for each
          suburb. Add a suburb in search preferences, then refresh coverage if
          needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {preferenceSuburbs.length === 0 ? (
          <p className="text-sm text-[#6B7280]">
            Save at least one suburb in search preferences to see coverage.
          </p>
        ) : (
          preferenceSuburbs.map((token) => {
            const agencies = bySuburb.get(token) ?? [];
            const title = formatSuburbPreferenceDisplay(token);
            return (
              <div
                key={token}
                className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-semibold text-[#111827]">
                    {title}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    className="shrink-0 gap-2 border-[#E5E7EB] bg-white"
                    onClick={() => onRefresh(token)}
                  >
                    {pendingSuburb === token ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh coverage
                  </Button>
                </div>

                {agencies.length === 0 ? (
                  <p className="mt-3 text-sm text-[#6B7280]">
                    No agencies stored yet. They are discovered automatically
                    when you add this suburb, or use Refresh coverage.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {agencies.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-[#111827]">
                          {a.agencyName}
                        </div>
                        <a
                          href={a.agencyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 break-all text-[#0D9488] hover:underline",
                          )}
                        >
                          {a.agencyUrl}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                        <div className="mt-1 text-xs text-[#6B7280]">
                          Last scraped: {formatScraped(a.lastScrapedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
