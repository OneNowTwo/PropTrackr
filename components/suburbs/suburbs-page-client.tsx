"use client";

import { MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { unfollowSuburb } from "@/app/actions/suburbs";
import type { FollowedSuburbRow } from "@/app/actions/suburbs";
import { SuburbSearchDialog } from "@/components/suburbs/suburb-search-dialog";
import { Card, CardContent } from "@/components/ui/card";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function suburbSlug(suburb: string, postcode: string) {
  return `${suburb.toLowerCase().replace(/\s+/g, "-")}-${postcode}`;
}

function staticMapUrl(suburb: string, state: string, postcode: string) {
  if (!MAPS_KEY) return "";
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(`${suburb} ${state} ${postcode} Australia`)}&zoom=14&size=400x200&scale=2&maptype=roadmap&key=${MAPS_KEY}`;
}

function UnfollowButton({ suburbId }: { suburbId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => { await unfollowSuburb(suburbId); });
      }}
      disabled={isPending}
      className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#9CA3AF] shadow-sm backdrop-blur-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      aria-label="Unfollow suburb"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function SuburbsPageClient({
  suburbs,
}: {
  suburbs: FollowedSuburbRow[];
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Suburbs
          </h1>
          <p className="mt-1 text-[#6B7280]">
            Track market data and your saved properties by suburb.
          </p>
        </div>
        <SuburbSearchDialog />
      </div>

      {suburbs.length === 0 ? (
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MapPin className="h-12 w-12 text-[#D1D5DB]" strokeWidth={1.25} />
            <p className="text-sm font-medium text-[#6B7280]">
              Follow suburbs to track market data and saved properties.
            </p>
            <div className="pt-2">
              <SuburbSearchDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {suburbs.map((s) => (
            <li key={s.id}>
              <Card className="group relative overflow-hidden rounded-xl border-[#E5E7EB] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                <UnfollowButton suburbId={s.id} />
                <CardContent className="p-0">
                  <Link
                    href={`/suburbs/${suburbSlug(s.suburb, s.postcode)}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
                  >
                    <div className="relative aspect-[2/1] w-full overflow-hidden bg-[#F3F4F6]">
                      {MAPS_KEY ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={staticMapUrl(s.suburb, s.state, s.postcode)}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#9CA3AF]">
                          <MapPin className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 p-5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-base font-semibold text-[#111827]">
                          {s.suburb}
                        </p>
                        <span className="shrink-0 text-sm text-[#6B7280]">
                          {s.state} {s.postcode}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 border-t border-[#E5E7EB] pt-2 text-sm text-[#6B7280]">
                        <span>
                          <span className="font-semibold tabular-nums text-[#0D9488]">
                            {s.propertyCount}
                          </span>{" "}
                          {s.propertyCount === 1 ? "property" : "properties"} saved
                        </span>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
