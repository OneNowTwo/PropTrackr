"use client";

import { Home } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

function buildGallery(
  imageUrl: string | null | undefined,
  imageUrls: string[] | null | undefined,
): string[] {
  const hero = imageUrl?.trim() ?? "";
  const extras = (imageUrls ?? [])
    .map((u) => u.trim())
    .filter(Boolean)
    .filter((u) => u !== hero);
  if (hero) return [hero, ...extras];
  return extras;
}

export function PropertyImageGallery({
  imageUrl,
  imageUrls,
}: {
  imageUrl: string | null;
  imageUrls: string[] | null;
}) {
  const gallery = useMemo(
    () => buildGallery(imageUrl, imageUrls),
    [imageUrl, imageUrls],
  );
  const [active, setActive] = useState(0);
  const galleryKey = gallery.join("|");

  useEffect(() => {
    setActive(0);
  }, [galleryKey]);

  if (gallery.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="relative aspect-[21/9] max-h-[320px] w-full bg-[#F3F4F6] sm:aspect-[2.4/1]">
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#6B7280]">
            <Home className="h-14 w-14 opacity-35" strokeWidth={1.25} />
            <span className="text-sm font-medium">No photo added</span>
          </div>
        </div>
      </div>
    );
  }

  const main = gallery[active] ?? gallery[0];

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="relative aspect-[21/9] max-h-[320px] w-full bg-[#F3F4F6] sm:aspect-[2.4/1]">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}
      </div>
      {gallery.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-t border-[#E5E7EB] bg-[#FAFAFA] p-3">
          {gallery.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border bg-white transition-shadow",
                i === active
                  ? "border-[#0D9488] ring-2 ring-[#0D9488]/40"
                  : "border-[#E5E7EB] hover:border-[#0D9488]/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
