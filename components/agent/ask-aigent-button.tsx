"use client";

import { Sparkles } from "lucide-react";

import { useAigent } from "@/components/agent/aigent-modal";
import { cn } from "@/lib/utils";

export function AskAigentButton({
  message,
  label,
  className,
}: {
  message: string;
  label: string;
  className?: string;
}) {
  const { open } = useAigent();

  return (
    <button
      type="button"
      onClick={() => open(message)}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/5 px-4 py-3 text-sm font-semibold text-[#0D9488] transition-colors hover:bg-[#0D9488]/10",
        className,
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
