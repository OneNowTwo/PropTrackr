"use client";

import {
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import {
  generatePropertyInsights,
  getPropertyInsightsCached,
} from "@/app/actions/agent";

type Insight = { title: string; content: string };

export function PropertyInsightsCard({
  propertyId,
  initialInsights,
}: {
  propertyId: string;
  initialInsights: Insight[];
}) {
  const [insights, setInsights] = useState<Insight[]>(initialInsights);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await generatePropertyInsights(propertyId);
      if (result.length) setInsights(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-[#111827]">
            Buyers Aigent Insights
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3 w-3", loading && "animate-spin")}
            />
            Refresh
          </button>
          <Link
            href={`/agent?property=${propertyId}`}
            className="flex items-center gap-1 rounded-lg bg-[#0D9488]/10 px-2.5 py-1 text-xs font-semibold text-[#0D9488] transition-colors hover:bg-[#0D9488]/20"
          >
            Ask Buyers Aigent <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="p-4">
        {loading && insights.length === 0 && (
          <div className="flex items-center gap-3 py-6 text-[#9CA3AF]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
            <span className="text-sm">Generating insights…</span>
          </div>
        )}
        {!loading && insights.length === 0 && (
          <div className="py-4 text-center">
            <Lightbulb className="mx-auto h-8 w-8 text-[#D1D5DB]" />
            <p className="mt-2 text-sm text-[#9CA3AF]">
              No insights yet.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-2 text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Generate insights
            </button>
          </div>
        )}
        {insights.length > 0 && (
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <div
                key={`${ins.title}-${i}`}
                className="flex gap-3 rounded-lg border border-[#F3F4F6] p-3"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">
                    {ins.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    {ins.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
