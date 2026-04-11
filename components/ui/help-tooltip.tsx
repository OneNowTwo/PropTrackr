"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type HelpTooltipProps = {
  title: string;
  content: string;
  link?: { text: string; href: string };
  className?: string;
};

export function HelpTooltip({
  title,
  content,
  link,
  className,
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Help: ${title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        ?
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-[120] mt-1.5 w-[min(18rem,calc(100vw-2rem))] max-w-xs rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          role="dialog"
          aria-label={title}
        >
          <p className="text-xs font-bold text-[#111827]">{title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            {content}
          </p>
          {link ? (
            <Link
              href={link.href}
              className="mt-2 inline-block text-xs font-semibold text-[#0D9488] hover:underline"
              onClick={() => setOpen(false)}
            >
              {link.text}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
