"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteAgent } from "@/app/actions/agents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  agentId: string;
  variant?: "default" | "compact";
  className?: string;
};

export function DeleteAgentButton({
  agentId,
  variant = "default",
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await deleteAgent(agentId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.push("/agents");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === "compact" ? "ghost" : "outline"}
        size={variant === "compact" ? "icon" : "default"}
        className={cn(
          variant === "compact"
            ? "h-8 w-8 shrink-0 text-[#6B7280] hover:bg-red-50 hover:text-red-600"
            : "inline-flex gap-2 border-[#E5E7EB] bg-white text-red-600 hover:bg-red-50 hover:text-red-700",
          className,
        )}
        aria-label="Delete agent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
        {variant === "default" ? (
          <span className="ml-2">Delete</span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#E5E7EB] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">Delete agent</DialogTitle>
            <DialogDescription className="text-left text-[#6B7280]">
              Delete this agent? They will be unlinked from your properties but
              property data will be kept.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[#E5E7EB]"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "Deleting…" : "Delete agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
