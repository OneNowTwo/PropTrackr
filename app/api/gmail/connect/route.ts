import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  googleClientId,
  googleRedirectUri,
  signGmailOAuthState,
} from "@/lib/gmail/oauth-state";

const GMAIL_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly email profile openid";

export async function GET(req: Request) {
  const { userId } = await auth();
  const origin = new URL(req.url).origin;
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const state = signGmailOAuthState({
    clerkId: userId,
    exp: Date.now() + 10 * 60 * 1000,
  });

  // Must match Google Cloud OAuth client + token exchange (callback uses the same env).
  const redirectUri = googleRedirectUri(); // process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  console.log("[gmail/connect] redirect_uri:", redirectUri);

  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
}
