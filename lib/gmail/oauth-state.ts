import { createHmac, timingSafeEqual } from "crypto";

export type GmailOAuthStatePayload = {
  clerkId: string;
  exp: number;
};

function getSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  return s;
}

export function signGmailOAuthState(payload: GmailOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGmailOAuthState(
  state: string | null,
): GmailOAuthStatePayload | null {
  if (!state) return null;
  const i = state.lastIndexOf(".");
  if (i <= 0) return null;
  const body = state.slice(0, i);
  const sig = state.slice(i + 1);
  try {
    const expected = createHmac("sha256", getSecret())
      .update(body)
      .digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GmailOAuthStatePayload;
    if (typeof parsed.clerkId !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function googleRedirectUri(): string {
  const u = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI?.trim();
  if (!u) {
    throw new Error("NEXT_PUBLIC_GOOGLE_REDIRECT_URI is not configured");
  }
  return u;
}

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not configured");
  return id;
}
