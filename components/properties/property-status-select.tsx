"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updatePropertyStatus } from "@/app/actions/properties";
import { PROPERTY_STATUSES } from "@/lib/property-form-constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PropertyStatus } from "@/types/property";
import { toast } from "@/hooks/use-toast";

const labels: Record<PropertyStatus, string> = {
  saved: "Saved",
  inspecting: "Inspecting",
  shortlisted: "Shortlisted",
  passed: "Passed",
};

export function PropertyStatusSelect({
  propertyId,
  value,
}: {
  propertyId: string;
  value: PropertyStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(next: string) {
    if (next === value) return;
    start(async () => {
      const r = await updatePropertyStatus(propertyId, next);
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Could not update status",
          description: r.error,
        });
        return;
      }
      toast({ title: "Status updated" });
      router.refresh();
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-9 w-[160px] border-[#E5E7EB] bg-white text-sm font-medium text-[#111827] focus:ring-[#0D9488]/30">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROPERTY_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {labels[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
