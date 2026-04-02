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

/** Public app origin for redirects — not the incoming request host (often wrong behind proxies). */
function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "https://proptrackr.onrender.com";
}

function redirectToAccount(searchPath: string): NextResponse {
  const target = new URL(searchPath, `${getAppOrigin()}/`);
  console.log("[gmail/callback] redirecting to account:", target.toString());
  return NextResponse.redirect(target);
}

export async function GET(req: Request) {
  console.log("[gmail/callback] request.url:", req.url);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return redirectToAccount(
      `/account?gmail=error&message=${encodeURIComponent(err)}`,
    );
  }

  const payload = verifyGmailOAuthState(state);
  if (!code || !payload) {
    return redirectToAccount("/account?gmail=invalid");
  }

  const { userId: clerkId } = await auth();
  if (!clerkId || clerkId !== payload.clerkId) {
    return redirectToAccount("/account?gmail=session");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, googleRedirectUri());
    const access = tokens.access_token;
    const gmailEmail = await getGmailProfileEmail(access);
    const refresh = tokens.refresh_token;
    if (!refresh) {
      return redirectToAccount("/account?gmail=no_refresh");
    }

    const full = await currentUser();
    const email = full?.emailAddresses[0]?.emailAddress;
    if (!email) {
      return redirectToAccount("/account?gmail=no_user");
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

    return redirectToAccount("/account?gmail=connected");
  } catch {
    return redirectToAccount("/account?gmail=failed");
  }
}
