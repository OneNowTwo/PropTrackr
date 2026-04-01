"use client";

import { Home } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Property } from "@/types/property";

function allImages(
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

/** Main image plus up to three thumbnail slots (extra photos first). */
export function ComparePropertyPhotos({
  property,
}: {
  property: Pick<Property, "imageUrl" | "imageUrls">;
}) {
  const extrasKey = (property.imageUrls ?? []).join("|");
  const urls = useMemo(
    () => allImages(property.imageUrl, property.imageUrls),
    [property.imageUrl, extrasKey],
  );
  const [active, setActive] = useState(0);
  const urlsKey = urls.join("|");

  useEffect(() => {
    setActive(0);
  }, [urlsKey]);

  const main = urls[active] ?? urls[0];
  const thumbPool = urls.filter((_, i) => i !== active).slice(0, 3);

  if (urls.length === 0) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F3F4F6]">
        <div className="flex h-full min-h-[100px] w-full flex-col items-center justify-center text-[#9CA3AF]">
          <Home className="h-8 w-8 opacity-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F3F4F6]">
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
      {thumbPool.length > 0 ? (
        <div className="flex gap-1.5">
          {thumbPool.map((url) => {
            const idx = urls.indexOf(url);
            return (
              <button
                key={url}
                type="button"
                onClick={() => setActive(idx >= 0 ? idx : 0)}
                className="relative h-10 w-14 shrink-0 overflow-hidden rounded border border-[#E5E7EB] bg-white hover:border-[#0D9488]/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
