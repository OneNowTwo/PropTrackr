import { Mail } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardEmailRow } from "@/lib/db/gmail-queries";

export function RecentEmailsWidget({ emails }: { emails: DashboardEmailRow[] }) {
  if (emails.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
            <Mail className="h-5 w-5 text-[#0D9488]" />
            Recent emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6B7280]">
            No property-linked emails yet. Connect Gmail under Account and run
            a sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
          <Mail className="h-5 w-5 text-[#0D9488]" />
          Recent emails
        </CardTitle>
        <Link
          href="/account"
          className="text-xs font-semibold text-[#0D9488] hover:underline"
        >
          Gmail settings
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {emails.map((e) => (
          <div
            key={e.id}
            className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-sm"
          >
            <p className="font-medium text-[#111827] line-clamp-1">
              {e.subject}
            </p>
            {e.propertyId ? (
              <Link
                href={`/properties/${e.propertyId}`}
                className="mt-1 inline-block text-xs font-semibold text-[#0D9488] hover:underline"
              >
                {e.propertyAddress}, {e.propertySuburb}
              </Link>
            ) : null}
            {e.aiSummary ? (
              <p className="mt-2 line-clamp-2 text-xs text-[#6B7280]">
                {e.aiSummary}
              </p>
            ) : null}
            <p className="mt-1 text-[10px] text-[#9CA3AF]">
              {e.receivedAt.toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
