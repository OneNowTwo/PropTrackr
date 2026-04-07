"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProperty } from "@/app/actions/properties";
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
  propertyId: string;
  /** compact = icon only for cards */
  variant?: "default" | "compact";
  className?: string;
};

export function DeletePropertyButton({
  propertyId,
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
      const r = await deleteProperty(propertyId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.push("/properties");
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
        aria-label="Delete property"
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
            <DialogTitle className="text-[#111827]">Delete property</DialogTitle>
            <DialogDescription className="text-left text-[#6B7280]">
              Delete this property? This will also remove all inspections, notes,
              voice notes, documents and emails linked to it.
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
              {pending ? "Deleting…" : "Delete property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
