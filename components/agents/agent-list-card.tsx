"use client";

import Link from "next/link";
import { Building2, Mail, Phone, Star } from "lucide-react";

import { DeleteAgentButton } from "@/components/agents/delete-agent-button";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentWithCount } from "@/lib/db/agent-queries";
import { cn } from "@/lib/utils";

function ListStarRow({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span
      className="inline-flex items-center gap-px text-amber-500"
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < filled ? "fill-current" : "fill-none",
          )}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export function AgentListCard({ agent: a }: { agent: AgentWithCount }) {
  const initial = a.name.trim()
    ? a.name.trim().charAt(0).toUpperCase()
    : a.agencyName?.trim()
      ? a.agencyName.trim().charAt(0).toUpperCase()
      : "?";

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-20 rounded-md border border-[#E5E7EB] bg-white/95 shadow-sm backdrop-blur-[2px]">
        <DeleteAgentButton agentId={a.id} variant="compact" />
      </div>
      <Link
        href={`/agents/${a.id}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F9FA]"
      >
        <Card className="h-full overflow-hidden border-[#E5E7EB] bg-white pr-10 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex gap-4">
              {a.photoUrl?.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.photoUrl.trim()}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-sm font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                  aria-hidden
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold leading-snug text-[#111827] group-hover:text-[#0D9488]">
                  {a.name}
                </p>
                {a.agencyName?.trim() ? (
                  <p className="text-sm text-[#6B7280]">{a.agencyName}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-4 text-sm">
              {a.phone?.trim() ? (
                <p className="flex items-center gap-2 text-[#6B7280]">
                  <Phone className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  <span className="truncate text-[#111827]">{a.phone.trim()}</span>
                </p>
              ) : null}
              {a.email?.trim() ? (
                <p className="flex items-center gap-2 text-[#6B7280]">
                  <Mail className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  <span className="truncate text-[#111827]">{a.email.trim()}</span>
                </p>
              ) : null}
              <p className="flex items-center gap-2 pt-1 text-[#6B7280]">
                <Building2 className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                <span>
                  <span className="font-medium tabular-nums text-[#111827]">
                    {a.propertyCount}
                  </span>{" "}
                  {a.propertyCount === 1 ? "property" : "properties"} saved
                </span>
              </p>
              {a.noteCount > 0 ? (
                <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-[#6B7280]">
                  {a.avgRating != null ? (
                    <>
                      <ListStarRow value={a.avgRating} />
                      <span className="font-medium tabular-nums text-[#111827]">
                        {a.avgRating.toFixed(1)}
                      </span>
                      <span className="text-[#9CA3AF]">
                        · {a.noteCount}{" "}
                        {a.noteCount === 1 ? "note" : "notes"}
                      </span>
                    </>
                  ) : (
                    <span>
                      {a.noteCount}{" "}
                      {a.noteCount === 1 ? "note" : "notes"}
                    </span>
                  )}
                </p>
              ) : (
                <p className="pt-1 text-sm text-[#9CA3AF]">No notes yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
