import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

import type { DashboardEmailRow } from "@/lib/db/gmail-queries";

export function RecentEmailsWidget({ emails }: { emails: DashboardEmailRow[] }) {
  if (emails.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Recent emails
            </p>
            <p className="mt-2 text-sm text-[#6B7280]">
              No property-linked emails yet. Connect Gmail under Account and run a sync.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Recent emails</p>
            <p className="text-xs text-[#9CA3AF]">{emails.length} linked to properties</p>
          </div>
        </div>
        <Link
          href="/account"
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          Gmail settings
        </Link>
      </div>
      <div className="divide-y divide-[#F3F4F6]">
        {emails.map((e) => (
          <div key={e.id} className="px-5 py-3">
            <p className="truncate text-sm font-medium text-[#111827]">
              {e.subject}
            </p>
            {e.propertyId ? (
              <Link
                href={`/properties/${e.propertyId}`}
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:underline"
              >
                {e.propertyAddress}, {e.propertySuburb}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
            {e.aiSummary ? (
              <p className="mt-1 line-clamp-1 text-xs text-[#6B7280]">
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
      </div>
    </div>
  );
}
