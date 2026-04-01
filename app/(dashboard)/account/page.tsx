import { UserProfile } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

import { SearchPreferencesForm } from "@/components/account/search-preferences-form";
import { SuburbCoverageSection } from "@/components/account/suburb-coverage-section";
import {
  getSearchPreferencesForUserSafe,
  getSuburbAgencyUrlsForClerkUserSafe,
} from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

export default async function AccountPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const prefs = await getSearchPreferencesForUserSafe(user?.id);
  const coverageRows = await getSuburbAgencyUrlsForClerkUserSafe(user?.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
          Account
        </h1>
        <p className="mt-1 text-[#6B7280]">
          Manage your profile and security settings.
        </p>
      </div>
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
