"use client";

import { Home } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function Placeholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#6B7280]">
      <Home className="h-14 w-14 opacity-35" strokeWidth={1.25} />
      <span className="text-sm font-medium">No photo added</span>
    </div>
  );
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
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const failedSet = useMemo(() => new Set(failedUrls), [failedUrls]);

  const markFailed = useCallback((url: string) => {
    if (!url) return;
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  const visibleGallery = useMemo(
    () => gallery.filter((u) => !failedSet.has(u)),
    [gallery, failedSet],
  );
  const visibleGalleryKey = visibleGallery.join("|");

  const [active, setActive] = useState(0);
  const galleryKey = gallery.join("|");

  useEffect(() => {
    setActive(0);
  }, [galleryKey]);

  useEffect(() => {
    if (visibleGallery.length === 0) return;
    setActive((i) => Math.min(i, visibleGallery.length - 1));
  }, [visibleGallery.length, visibleGalleryKey]);

  if (gallery.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="relative aspect-[4/3] min-h-[220px] w-full max-h-[min(560px,72vh)] bg-[#F3F4F6] sm:aspect-[16/10]">
          <Placeholder />
        </div>
      </div>
    );
  }

  const main = visibleGallery[active] ?? visibleGallery[0];
  const showThumbs = visibleGallery.length > 1;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="relative aspect-[4/3] min-h-[240px] w-full max-h-[min(560px,72vh)] bg-[#F3F4F6] sm:aspect-[16/10]">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => markFailed(main)}
          />
        ) : (
          <Placeholder />
        )}
      </div>
      {showThumbs ? (
        <div className="flex gap-2 overflow-x-auto border-t border-[#E5E7EB] bg-[#FAFAFA] p-3">
          {visibleGallery.map((url, i) => (
            <button
              key={`${i}-${url.slice(0, 80)}`}
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
                onError={() => markFailed(url)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
