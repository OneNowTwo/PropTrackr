"use client";

import { Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function DiscoverPasteCard() {
  const [url, setUrl] = useState("");

  const href =
    url.trim().length > 0
      ? `/properties/new?url=${encodeURIComponent(url.trim())}`
      : "/properties/new";

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
        Discover properties
      </h2>
      <Card className="overflow-hidden border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="border-b border-[#E5E7EB] bg-gradient-to-r from-[#0D9488]/6 to-transparent pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
              <Link2 className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <CardTitle className="text-base font-semibold text-[#111827]">
                Paste any listing URL
              </CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
                Instantly save a property with all details auto-extracted from
                the page.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="url"
              name="listing-url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 flex-1 border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] placeholder:text-[#9CA3AF] focus-visible:ring-[#0D9488]/30"
            />
            <Button
              className="h-11 shrink-0 gap-2 bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
              asChild
            >
              <Link href={href}>
                <Plus className="h-4 w-4" />
                Add property
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
