import Link from "next/link";

import { NewPropertyForm } from "@/components/properties/new-property-form";
import { Button } from "@/components/ui/button";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function NewPropertyPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/properties">← Back to properties</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Add property
        </h1>
        <p className="mt-1 text-ink-muted">
          Paste a listing URL to autofill, then save — or enter details
          manually.
        </p>
      </div>
      <NewPropertyForm />
    </div>
  );
}
