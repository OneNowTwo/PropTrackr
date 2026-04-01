"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { discoverAndPersistAgencyUrlsForSuburb } from "@/lib/discovery/find-agency-urls";
import { getOrCreateUserByClerkId } from "@/lib/db/users";

export type SuburbCoverageActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

async function requireDbUserForCoverage() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  return getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
}

/** Re-run agency URL discovery for one suburb (account page). */
export async function refreshSuburbAgencyCoverage(
  suburb: string,
): Promise<SuburbCoverageActionResult> {
  const dbUser = await requireDbUserForCoverage();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }
  const trimmed = suburb.trim();
  if (!trimmed) {
    return { ok: false, error: "Suburb is required." };
  }

  const res = await discoverAndPersistAgencyUrlsForSuburb(dbUser.id, trimmed);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true, count: res.count };
}
