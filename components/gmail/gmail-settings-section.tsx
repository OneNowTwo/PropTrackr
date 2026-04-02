"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { disconnectGmail } from "@/app/actions/gmail";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
export type GmailConnectionPublic = {
  gmailEmail: string;
  lastSyncedAt: string | null;
};

export function GmailSettingsSection({
  connection,
}: {
  connection: GmailConnectionPublic | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const gmailParam = searchParams.get("gmail");
  const toasted = useRef(false);
  useEffect(() => {
    if (gmailParam === "connected" && !toasted.current) {
      toasted.current = true;
      toast({ title: "Gmail connected" });
      router.replace("/account");
    }
  }, [gmailParam, router]);

  async function onSync() {
    start(async () => {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        imported?: number;
      };
      if (!res.ok || !data.ok) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: data.error ?? "Try again.",
        });
        return;
      }
      toast({
        title: "Gmail synced",
        description:
          data.imported != null
            ? `${data.imported} new message(s) imported.`
            : undefined,
      });
      router.refresh();
    });
  }

  async function onDisconnect() {
    start(async () => {
      const r = await disconnectGmail();
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Could not disconnect",
          description: r.error,
        });
        return;
      }
      toast({ title: "Gmail disconnected" });
      router.refresh();
    });
  }

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#111827]">Gmail</CardTitle>
        <p className="text-sm text-[#6B7280]">
          Connect Gmail to import messages and match them to your properties.
          Uses a separate Google sign-in with read-only Gmail access (not your
          Clerk login).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection ? (
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
              asChild
            >
              <Link href="/api/gmail/connect">Connect Gmail</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-[#6B7280]">Connected as </span>
              <span className="font-semibold text-[#111827]">
                {connection.gmailEmail}
              </span>
            </p>
            <p className="text-[#6B7280]">
              Last synced:{" "}
              {connection.lastSyncedAt
                ? new Date(connection.lastSyncedAt).toLocaleString("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Never"}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                disabled={pending}
                className="bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
                onClick={onSync}
              >
                Sync now
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Daily auto-sync can be enabled later via a scheduled job.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
