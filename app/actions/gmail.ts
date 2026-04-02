"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { gmailConnections } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";

/** Start standalone Google OAuth (gmail.readonly). Prefer linking to `/api/gmail/connect`. */
export async function connectGmail() {
  redirect("/api/gmail/connect");
}

export async function disconnectGmail(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "Not signed in." };
  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (!email) return { ok: false, error: "Account needs an email." };
    const dbUser = await getOrCreateUserByClerkId({
      clerkId,
      email,
      name: clerkUser?.fullName ?? null,
    });
    const db = getDb();
    await db
      .delete(gmailConnections)
      .where(eq(gmailConnections.userId, dbUser.id));
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not disconnect.";
    return { ok: false, error: message };
  }
}
