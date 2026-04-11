"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import {
  householdInvites,
  householdMembers,
  households,
  users,
} from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HouseholdMember = {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string;
  joinedAt: Date;
};

export type HouseholdInvite = {
  id: string;
  inviteEmail: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
};

export type HouseholdData = {
  householdId: string;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
} | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId || !process.env.DATABASE_URL) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getHousehold(): Promise<HouseholdData> {
  try {
    const userId = await resolveUserId();
    if (!userId) return null;

    const db = getDb();
    const [membership] = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!membership) return null;

    const hhId = membership.householdId;

    const memberRows = await db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        name: users.name,
        email: users.email,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, hhId));

    const inviteRows = await db
      .select()
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.householdId, hhId),
          isNull(householdInvites.acceptedAt),
        ),
      );

    return {
      householdId: hhId,
      members: memberRows,
      invites: inviteRows.map((i) => ({
        id: i.id,
        inviteEmail: i.inviteEmail,
        token: i.token,
        expiresAt: i.expiresAt,
        acceptedAt: i.acceptedAt,
        createdAt: i.createdAt,
      })),
    };
  } catch (e) {
    console.error("[household] getHousehold error:", e);
    return null;
  }
}

export async function createHousehold(): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false, error: "Not authenticated" };

    const db = getDb();

    const [existing] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (existing) return { ok: false, error: "Already in a household" };

    const [hh] = await db.insert(households).values({}).returning();
    await db.insert(householdMembers).values({
      householdId: hh.id,
      userId,
      role: "owner",
    });

    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    console.error("[household] createHousehold error:", e);
    return { ok: false, error: "Failed to create household" };
  }
}

export async function invitePartner(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  console.log("[household] invitePartner called for email:", email);
  console.log(
    "[household] RESEND_API_KEY exists:",
    Boolean(process.env.RESEND_API_KEY),
  );
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false, error: "Not authenticated" };

    const db = getDb();

    let [membership] = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!membership) {
      const [hh] = await db.insert(households).values({}).returning();
      await db.insert(householdMembers).values({
        householdId: hh.id,
        userId,
        role: "owner",
      });
      membership = { householdId: hh.id };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const inviteTo = email.toLowerCase().trim();

    await db.insert(householdInvites).values({
      householdId: membership.householdId,
      invitedByUserId: userId,
      inviteEmail: inviteTo,
      token,
      expiresAt,
    });

    const [inviterUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const inviterName = inviterUser?.name ?? "Your partner";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://proptrackr.onrender.com";
    const inviteUrl = `${appUrl}/invite/${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        console.log("[household] sending invite email to:", inviteTo);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "PropTrackr <noreply@onenowtwo.com.au>",
            to: [inviteTo],
            subject: `${inviterName} invited you to join their PropTrackr search`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #111827; font-size: 20px;">${inviterName} has invited you to join their property search on PropTrackr</h2>
                <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                  You'll share saved properties, inspections, notes, and photos — everything you need to search together.
                </p>
                <a href="${inviteUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #0D9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Join ${inviterName}'s search
                </a>
                <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">This invite expires in 7 days.</p>
              </div>
            `,
          }),
        });
        const raw = await res.text();
        let parsed: Record<string, unknown> = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            parsed = { unparsedBody: raw };
          }
        }
        const result = { httpStatus: res.status, httpOk: res.ok, ...parsed };
        console.log("[household] resend result:", JSON.stringify(result));
        if (!res.ok) {
          console.error("[household] resend error:", result);
        }
      } catch (error) {
        console.error("[household] resend error:", error);
      }
    } else {
      console.log("[household] No RESEND_API_KEY — invite URL:", inviteUrl);
    }

    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    console.error("[household] invitePartner error:", e);
    return { ok: false, error: "Failed to send invite" };
  }
}

export async function acceptInvite(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false, error: "Not authenticated" };

    const db = getDb();

    const [invite] = await db
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.token, token))
      .limit(1);

    if (!invite) return { ok: false, error: "Invite not found" };
    if (invite.acceptedAt) return { ok: false, error: "Invite already used" };
    if (invite.expiresAt < new Date()) return { ok: false, error: "Invite expired" };

    const [existingMembership] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (existingMembership) return { ok: false, error: "You're already in a household" };

    await db.insert(householdMembers).values({
      householdId: invite.householdId,
      userId,
      role: "member",
    });

    await db
      .update(householdInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(householdInvites.id, invite.id));

    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath("/properties");
    return { ok: true };
  } catch (e) {
    console.error("[household] acceptInvite error:", e);
    return { ok: false, error: "Failed to accept invite" };
  }
}

export async function leaveHousehold(): Promise<{ ok: boolean }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false };

    const db = getDb();
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.userId, userId));

    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath("/properties");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function removeHouseholdMember(
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false, error: "Not authenticated" };

    const db = getDb();

    const [myMembership] = await db
      .select({ householdId: householdMembers.householdId, role: householdMembers.role })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (!myMembership || myMembership.role !== "owner") {
      return { ok: false, error: "Only the household owner can remove members" };
    }

    await db.delete(householdMembers).where(eq(householdMembers.id, memberId));

    revalidatePath("/account");
    revalidatePath("/dashboard");
    revalidatePath("/properties");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to remove member" };
  }
}

export async function cancelInvite(
  inviteId: string,
): Promise<{ ok: boolean }> {
  try {
    const userId = await resolveUserId();
    if (!userId) return { ok: false };

    const db = getDb();
    await db.delete(householdInvites).where(eq(householdInvites.id, inviteId));

    revalidatePath("/account");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getInviteDetails(token: string) {
  try {
    const db = getDb();
    const [invite] = await db
      .select({
        id: householdInvites.id,
        inviteEmail: householdInvites.inviteEmail,
        expiresAt: householdInvites.expiresAt,
        acceptedAt: householdInvites.acceptedAt,
        inviterName: users.name,
        inviterEmail: users.email,
      })
      .from(householdInvites)
      .innerJoin(users, eq(householdInvites.invitedByUserId, users.id))
      .where(eq(householdInvites.token, token))
      .limit(1);

    return invite ?? null;
  } catch {
    return null;
  }
}
