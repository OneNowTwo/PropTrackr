"use client";

import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { propertyEmails } from "@/lib/db/schema";

type Row = Omit<
  typeof propertyEmails.$inferSelect,
  "receivedAt" | "createdAt"
> & { receivedAt: Date | string; createdAt: Date | string };

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function AgentEmailsSection({ emails }: { emails: Row[] }) {
  const [openThread, setOpenThread] = useState<string | null>(null);

  const threads = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const e of emails) {
      const key = e.threadId || e.id;
      const list = m.get(key) ?? [];
      list.push(e);
      m.set(key, list);
    }
    Array.from(m.values()).forEach((list) => {
      list.sort(
        (a, b) => asDate(b.receivedAt).getTime() - asDate(a.receivedAt).getTime(),
      );
    });
    return Array.from(m.entries()).sort(
      (a, b) =>
        (b[1][0] ? asDate(b[1][0].receivedAt).getTime() : 0) -
        (a[1][0] ? asDate(a[1][0].receivedAt).getTime() : 0),
    );
  }, [emails]);

  if (emails.length === 0) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
            <Mail className="h-5 w-5 text-[#0D9488]" />
            Correspondence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6B7280]">
            No Gmail threads with this agent yet. Connect Gmail and sync from
            Account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#111827]">
          <Mail className="h-5 w-5 text-[#0D9488]" />
          Correspondence
        </CardTitle>
        <p className="text-sm text-[#6B7280]">
          Threads grouped by Gmail thread (subject line from latest message).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {threads.map(([threadId, rows]) => {
          const latest = rows[0];
          const expanded = openThread === threadId;
          return (
            <div
              key={threadId}
              className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenThread(expanded ? null : threadId)
                }
                className="flex w-full items-center justify-between gap-2 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#111827]">
                    {latest?.subject ?? "(no subject)"}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {rows.length} message{rows.length === 1 ? "" : "s"} ·{" "}
                    {latest
                      ? asDate(latest.receivedAt).toLocaleDateString("en-AU", {
                          dateStyle: "medium",
                        })
                      : ""}
                  </p>
                </div>
                {expanded ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-[#6B7280]" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#6B7280]" />
                )}
              </button>
              {expanded ? (
                <ul className="space-y-3 border-t border-[#E5E7EB] px-4 py-3">
                  {rows.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-md border border-[#E5E7EB] bg-white p-3 text-sm"
                    >
                      <p className="text-xs text-[#9CA3AF]">
                        {asDate(e.receivedAt).toLocaleString("en-AU", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {e.aiSummary ? (
                        <p className="mt-2 text-[#374151]">{e.aiSummary}</p>
                      ) : (
                        <p className={cn("mt-2 text-[#6B7280]")}>
                          {e.bodyText?.slice(0, 280)}
                          {(e.bodyText?.length ?? 0) > 280 ? "…" : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
