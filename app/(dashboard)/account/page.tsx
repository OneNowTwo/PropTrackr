import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile and security settings.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
        <UserProfile
          appearance={{
            variables: {
              colorPrimary: "#0D9488",
              colorBackground: "#1E293B",
              colorInputBackground: "#0F172A",
            },
          }}
        />
      </div>
    </div>
  );
}
