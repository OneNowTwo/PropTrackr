import { eq } from "drizzle-orm";

import { getDb } from "./index";
import { users } from "./schema";

export async function getOrCreateUserByClerkId(params: {
  clerkId: string;
  email: string;
  name: string | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, params.clerkId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      clerkId: params.clerkId,
      email: params.email,
      name: params.name,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}

type ClerkLikeUser = {
  id: string;
  emailAddresses: { emailAddress: string }[];
  fullName: string | null;
};

export async function ensureClerkUserSynced(user: ClerkLikeUser | null) {
  if (!user || !process.env.DATABASE_URL) return;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return;
  try {
    await getOrCreateUserByClerkId({
      clerkId: user.id,
      email,
      name: user.fullName,
    });
  } catch {
    // DB unavailable or misconfigured — pages still render with empty data
  }
}
