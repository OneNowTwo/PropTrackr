import { UserProfile } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { SearchPreferencesForm } from "@/components/account/search-preferences-form";
import { SuburbCoverageSection } from "@/components/account/suburb-coverage-section";
import { GmailSettingsSection } from "@/components/gmail/gmail-settings-section";
import { UnmatchedEmailsCard } from "@/components/gmail/unmatched-emails-card";
import {
  getGmailConnectionForClerkSafe,
  getUnmatchedPropertyEmailsForUserSafe,
} from "@/lib/db/gmail-queries";
import {
  getPropertiesForClerkUserSafe,
  getSearchPreferencesForUserSafe,
  getSuburbAgencyUrlsForClerkUserSafe,
} from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

function GmailSectionFallback() {
  return (
    <div className="h-32 animate-pulse rounded-xl border border-[#E5E7EB] bg-white" />
  );
}

export default async function AccountPage() {
  const user = await currentUser();
  const { userId: clerkUserId } = await auth();
  await ensureClerkUserSynced(user);
  const idForQueries = clerkUserId ?? user?.id ?? undefined;
  const [prefs, coverageRows, gmailConn, unmatched, props] = await Promise.all([
    getSearchPreferencesForUserSafe(idForQueries),
    getSuburbAgencyUrlsForClerkUserSafe(idForQueries),
    getGmailConnectionForClerkSafe(idForQueries),
    getUnmatchedPropertyEmailsForUserSafe(idForQueries),
    getPropertiesForClerkUserSafe(idForQueries),
  ]);

  const gmailPublic = gmailConn
    ? {
        gmailEmail: gmailConn.gmailEmail,
        lastSyncedAt: gmailConn.lastSyncedAt?.toISOString() ?? null,
      }
    : null;

  const unmatchedClient = JSON.parse(JSON.stringify(unmatched));
  const propsPick = props.map((p) => ({
    id: p.id,
    address: p.address,
    suburb: p.suburb,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Account
        </h1>
        <p className="mt-1 text-[#6B7280]">
          Manage your profile, Gmail, and search settings.
        </p>
      </div>

      <Suspense fallback={<GmailSectionFallback />}>
        <GmailSettingsSection connection={gmailPublic} />
      </Suspense>

      <UnmatchedEmailsCard
        emails={unmatchedClient}
        properties={propsPick}
      />

      <SearchPreferencesForm initial={prefs} />

      <SuburbCoverageSection
        preferenceSuburbs={prefs?.suburbs ?? []}
        rows={coverageRows}
      />

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
        <UserProfile
          appearance={{
            variables: {
              colorPrimary: "#0D9488",
              colorBackground: "#ffffff",
              colorInputBackground: "#F9FAFB",
              colorText: "#111827",
              colorTextSecondary: "#6B7280",
            },
          }}
        />
      </div>
    </div>
  );
}
