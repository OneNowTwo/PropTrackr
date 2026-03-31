import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Account
        </h1>
        <p className="mt-1 text-ink-muted">
          Manage your profile and security settings.
        </p>
      </div>
      <div className="rounded-xl border border-line bg-white p-2 shadow-card">
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
