"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function PropertyShareButton({ listingUrl }: { listingUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const url = listingUrl?.trim() ?? "";

  async function copy() {
    if (!url) {
      toast({
        variant: "destructive",
        title: "No listing URL",
        description: "This property has no external listing link saved.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Listing URL copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy",
        description: "Copy the URL from your browser manually.",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!url}
      onClick={copy}
      className="shrink-0 gap-2 border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F8F9FA]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#0D9488]" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      Share
    </Button>
  );
}
