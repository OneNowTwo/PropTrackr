"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { assignPropertyEmailToProperty } from "@/app/actions/gmail-sync";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { propertyEmails } from "@/lib/db/schema";
import type { Property } from "@/types/property";

export function UnmatchedEmailsCard({
  emails,
  properties,
}: {
  emails: (typeof propertyEmails.$inferSelect)[];
  properties: Pick<Property, "id" | "address" | "suburb">[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function assign(emailId: string, propertyId: string) {
    if (!propertyId) return;
    start(async () => {
      const r = await assignPropertyEmailToProperty(emailId, propertyId);
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Could not assign",
          description: r.error,
        });
        return;
      }
      toast({ title: "Email assigned to property" });
      router.refresh();
    });
  }

  if (emails.length === 0) return null;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">
          Unassigned emails
        </CardTitle>
        <p className="text-sm text-[#6B7280]">
          These messages look property-related but weren&apos;t matched to an
          address. Assign them to a listing.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-[#111827]">{e.subject}</p>
              <p className="truncate text-sm text-[#6B7280]">
                {e.fromName ?? e.fromEmail}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Select
                disabled={pending || properties.length === 0}
                onValueChange={(pid) => assign(e.id, pid)}
              >
                <SelectTrigger className="w-[220px] border-[#E5E7EB]">
                  <SelectValue placeholder="Assign to property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
