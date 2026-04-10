import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { acceptInvite, getInviteDetails } from "@/app/actions/household";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInviteButton } from "@/components/household/accept-invite-button";

type Props = { params: { token: string } };

export default async function InvitePage({ params }: Props) {
  const { token } = params;
  const invite = await getInviteDetails(token);
  const { userId } = await auth();

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
        <Card className="w-full max-w-md border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-[#111827]">Invite not found</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              This invite link is invalid or has been deleted.
            </p>
            <Link
              href="/landing"
              className="mt-6 inline-block rounded-lg bg-[#0D9488] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90"
            >
              Go to PropTrackr
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
        <Card className="w-full max-w-md border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-[#111827]">Invite already accepted</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              This invite has already been used.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-[#0D9488] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90"
            >
              Go to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
        <Card className="w-full max-w-md border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-[#111827]">Invite expired</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              This invite has expired. Ask your partner to send a new one.
            </p>
            <Link
              href="/landing"
              className="mt-6 inline-block rounded-lg bg-[#0D9488] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90"
            >
              Go to PropTrackr
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inviterName = invite.inviterName ?? invite.inviterEmail;

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
        <Card className="w-full max-w-md border-[#E5E7EB] bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0D9488]/10">
              <span className="text-2xl">🏠</span>
            </div>
            <h1 className="text-xl font-semibold text-[#111827]">
              {inviterName} invited you to join their property search
            </h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              You&apos;ll share saved properties, inspections, notes, and photos — everything you need to search together.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/sign-up?redirect_url=/invite/${token}`}
                className="inline-block rounded-lg bg-[#0D9488] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0D9488]/90"
              >
                Sign up to join
              </Link>
              <Link
                href={`/sign-in?redirect_url=/invite/${token}`}
                className="inline-block rounded-lg border border-[#E5E7EB] bg-white px-6 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Already have an account? Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
      <Card className="w-full max-w-md border-[#E5E7EB] bg-white shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0D9488]/10">
            <span className="text-2xl">🏠</span>
          </div>
          <h1 className="text-xl font-semibold text-[#111827]">
            Join {inviterName}&apos;s property search
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            You&apos;ll share all saved properties, inspections, notes, and photos.
          </p>
          <AcceptInviteButton token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
