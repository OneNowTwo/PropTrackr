"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

export function MobileFab() {
  return (
    <Link
      href="/properties/new"
      className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#0D9488] text-white shadow-lg shadow-[#0D9488]/30 transition-transform active:scale-95 md:hidden"
      aria-label="Add property"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  );
}
