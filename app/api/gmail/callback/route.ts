import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { gmailConnections } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { getGmailProfileEmail } from "@/lib/gmail/gmail-api";
import {
  googleRedirectUri,
  verifyGmailOAuthState,
} from "@/lib/gmail/oauth-state";
import { exchangeCodeForTokens } from "@/lib/gmail/google-token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      new URL(`/account?gmail=error&message=${encodeURIComponent(err)}`, origin),
    );
  }

  const payload = verifyGmailOAuthState(state);
  if (!code || !payload) {
    return NextResponse.redirect(new URL("/account?gmail=invalid", origin));
  }

  const { userId: clerkId } = await auth();
  if (!clerkId || clerkId !== payload.clerkId) {
    return NextResponse.redirect(new URL("/account?gmail=session", origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, googleRedirectUri());
    const access = tokens.access_token;
    const gmailEmail = await getGmailProfileEmail(access);
    const refresh = tokens.refresh_token;
    if (!refresh) {
      return NextResponse.redirect(
        new URL("/account?gmail=no_refresh", origin),
      );
    }

    const full = await currentUser();
    const email = full?.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.redirect(new URL("/account?gmail=no_user", origin));
    }

    const dbUser = await getOrCreateUserByClerkId({
      clerkId,
      email,
      name: full?.fullName ?? null,
    });

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);
    const db = getDb();
    await db
      .insert(gmailConnections)
      .values({
        userId: dbUser.id,
        gmailEmail,
        accessToken: access,
        refreshToken: refresh,
        tokenExpiry: expiry,
      })
      .onConflictDoUpdate({
        target: gmailConnections.userId,
        set: {
          gmailEmail,
          accessToken: access,
          refreshToken: refresh,
          tokenExpiry: expiry,
        },
      });

    return NextResponse.redirect(new URL("/account?gmail=connected", origin));
  } catch {
    return NextResponse.redirect(new URL("/account?gmail=failed", origin));
  }
}
