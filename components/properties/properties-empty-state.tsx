"use client";

import { Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PropertiesEmptyState() {
  const [url, setUrl] = useState("");
  const href =
    url.trim().length > 0
      ? `/properties/new?url=${encodeURIComponent(url.trim())}`
      : "/properties/new";

  return (
    <Card className="overflow-hidden border-dashed border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="border-b border-[#E5E7EB] bg-gradient-to-r from-[#0D9488]/6 to-transparent">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-lg font-semibold text-[#111827]">
              Start with one listing
            </CardTitle>
            <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
              Paste a realestate.com.au or domain.com.au URL — we&apos;ll pull
              address, price, photos, and open-home times automatically.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11 flex-1 border-[#E5E7EB] bg-[#F9FAFB] focus-visible:ring-[#0D9488]/30"
          />
          <Button
            className="h-11 shrink-0 gap-2 bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
            asChild
          >
            <Link href={href}>
              <Plus className="h-4 w-4" />
              Add first property
            </Link>
          </Button>
        </div>
        <p className="text-xs text-[#9CA3AF]">
          Or skip the URL and enter details manually on the next screen.
        </p>
      </CardContent>
    </Card>
  );
}
