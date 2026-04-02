"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Quick add — visible on small screens only. */
export function FloatingAddButton() {
  return (
    <div className="fixed bottom-5 right-5 z-40 md:hidden">
      <Button
        size="lg"
        className="h-14 w-14 rounded-full bg-[#0D9488] p-0 shadow-lg shadow-[#0D9488]/35 hover:bg-[#0D9488]/90"
        asChild
      >
        <Link href="/properties/new" aria-label="Add property">
          <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
        </Link>
      </Button>
    </div>
  );
}
