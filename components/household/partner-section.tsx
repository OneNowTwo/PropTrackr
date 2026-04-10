"use client";

import { Clock, Loader2, Trash2, UserPlus, Users2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import type { HouseholdData } from "@/app/actions/household";
import {
  cancelInvite,
  invitePartner,
  leaveHousehold,
  removeHouseholdMember,
} from "@/app/actions/household";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

export function PartnerSection({
  household,
  currentUserId,
}: {
  household: HouseholdData;
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await invitePartner(inviteEmail.trim());
      if (res.ok) {
        setInviteEmail("");
        setShowInvite(false);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to send invite");
      }
    });
  }, [inviteEmail, router]);

  const handleLeave = useCallback(() => {
    startTransition(async () => {
      await leaveHousehold();
      router.refresh();
    });
  }, [router]);

  const handleRemove = useCallback(
    (memberId: string) => {
      startTransition(async () => {
        await removeHouseholdMember(memberId);
        router.refresh();
      });
    },
    [router],
  );

  const handleCancelInvite = useCallback(
    (inviteId: string) => {
      startTransition(async () => {
        await cancelInvite(inviteId);
        router.refresh();
      });
    },
    [router],
  );

  const partner = household?.members.find((m) => m.userId !== currentUserId);
  const myRole = household?.members.find((m) => m.userId === currentUserId)?.role;
  const pendingInvites = household?.invites ?? [];

  // No household yet
  if (!household) {
    return (
      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <Users2 className="h-4 w-4" />
          </span>
          <CardTitle className="text-base text-[#111827]">
            Search partner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6B7280]">
            Searching with a partner? Invite them to share all your saved properties, inspections, and notes.
          </p>

          {showInvite ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="partner@email.com"
                  onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                  className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
                />
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={isPending || !inviteEmail.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D9488]/90 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Send
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="text-xs text-[#6B7280] hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90"
            >
              <UserPlus className="h-4 w-4" />
              Invite partner
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Has household with partner
  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <Users2 className="h-4 w-4" />
        </span>
        <CardTitle className="text-base text-[#111827]">
          Search partner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {partner ? (
          <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D9488] text-sm font-semibold text-white">
              {initials(partner.name, partner.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#111827]">
                {partner.name ?? partner.email}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600">
                  Searching together
                </span>
              </div>
            </div>
            {myRole === "owner" && (
              <button
                type="button"
                onClick={() => handleRemove(partner.id)}
                disabled={isPending}
                className="rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-red-500"
                title="Remove partner"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">
            No partner has joined yet.
          </p>
        )}

        {/* Pending invites */}
        {pendingInvites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <Clock className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#111827]">
                Invite sent to {inv.inviteEmail}
              </p>
              <p className="text-xs text-[#6B7280]">
                Expires {new Date(inv.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCancelInvite(inv.id)}
              disabled={isPending}
              className="rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:text-red-500"
              title="Cancel invite"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Invite more if no partner yet */}
        {!partner && pendingInvites.length === 0 && (
          <>
            {showInvite ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="partner@email.com"
                    onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                    className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
                  />
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isPending || !inviteEmail.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D9488]/90 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Send
                  </button>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#F9FAFB]"
              >
                <UserPlus className="h-4 w-4 text-[#0D9488]" />
                Invite partner
              </button>
            )}
          </>
        )}

        {/* Leave household */}
        {household && (
          <div className="border-t border-[#E5E7EB] pt-3">
            {confirmLeave ? (
              <div className="flex items-center gap-3">
                <p className="text-xs text-[#6B7280]">Leave this household?</p>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={isPending}
                  className="text-xs font-medium text-red-500 hover:underline"
                >
                  Yes, leave
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  className="text-xs text-[#6B7280] hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="text-xs text-[#9CA3AF] hover:text-red-500 hover:underline"
              >
                Leave household
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
