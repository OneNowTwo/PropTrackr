"use client";

import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { documents, propertyEmails } from "@/lib/db/schema";

type EmailRow = Omit<
  typeof propertyEmails.$inferSelect,
  "receivedAt" | "createdAt"
> & { receivedAt: Date | string; createdAt: Date | string };

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}
type DocRow = Pick<
  typeof documents.$inferSelect,
  "id" | "fileUrl" | "fileName" | "fileType" | "gmailMessageId"
>;

export function PropertyEmailsSection({
  emails,
  attachmentsByMessageId,
}: {
  emails: EmailRow[];
  attachmentsByMessageId: Record<string, DocRow[]>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const unread = useMemo(() => emails.filter((e) => !e.isRead).length, [emails]);

  if (emails.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
            <Mail className="h-5 w-5 text-[#0D9488]" />
            Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6B7280]">
            No Gmail messages matched to this property yet. Connect Gmail in
            Account and run a sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base text-[#111827]">
          <Mail className="h-5 w-5 text-[#0D9488]" />
          Emails
          {unread > 0 ? (
            <Badge className="bg-[#0D9488] text-white hover:bg-[#0D9488]/90">
              {unread} unread
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emails.map((e) => {
          const expanded = openId === e.id;
          const atts = attachmentsByMessageId[e.gmailMessageId] ?? [];
          return (
            <div
              key={e.id}
              className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#111827]">{e.subject}</p>
                  <p className="text-sm text-[#6B7280]">
                    {e.fromName ? `${e.fromName} · ` : ""}
                    {e.fromEmail}
                  </p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    {asDate(e.receivedAt).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : e.id)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#0D9488] hover:underline"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Expand
                    </>
                  )}
                </button>
              </div>
              {e.aiSummary ? (
                <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                  {e.aiSummary}
                </p>
              ) : null}
              {e.actionItems?.length ? (
                <ul className="mt-3 space-y-1 border-l-2 border-[#0D9488] pl-3">
                  {e.actionItems.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm font-medium text-[#0F766E]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {atts.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {atts.map((d) => (
                    <Link
                      key={d.id}
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#0D9488] hover:underline"
                    >
                      📎 {d.fileName}
                    </Link>
                  ))}
                </div>
              ) : null}
              {expanded ? (
                <pre
                  className={cn(
                    "mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-[#E5E7EB] bg-white p-3 text-xs text-[#374151]",
                  )}
                >
                  {e.bodyText?.trim() || "(No plain-text body)"}
                </pre>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
