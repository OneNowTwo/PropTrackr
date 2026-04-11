"use server";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";

const NOTIFY_TO = "michael.l.hegarty@gmail.com";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(email: string): boolean {
  const t = email.trim();
  if (t.length > 254 || t.length < 3) return false;
  return EMAIL_RE.test(t);
}

async function sendWaitlistNotification(email: string, source: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[waitlist] RESEND_API_KEY not set — skipping notify email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PropTrackr <noreply@onenowtwo.com.au>",
        to: [NOTIFY_TO],
        subject: `New PropTrackr waitlist signup: ${email}`,
        text: `Email: ${email}\nSource: ${source}\n`,
        html: `<p><strong>New PropTrackr waitlist signup</strong></p><p>Email: ${escapeHtml(email)}</p><p>Source: ${escapeHtml(source)}</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn("[waitlist] Resend error:", res.status, body);
    }
  } catch (e) {
    console.warn("[waitlist] notify email failed:", e);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function submitToWaitlist(
  email: string,
  source: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter your email." };
  }
  if (!isValidEmail(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const normalized = trimmed.toLowerCase();
  const src = source.trim().slice(0, 120) || "unknown";

  try {
    const db = getDb();
    const inserted = await db
      .insert(waitlist)
      .values({ email: normalized, source: src })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id });

    if (inserted.length > 0) {
      void sendWaitlistNotification(normalized, src);
    } else {
      await db
        .update(waitlist)
        .set({ source: src })
        .where(eq(waitlist.email, normalized));
    }

    return { ok: true };
  } catch (e) {
    console.error("[waitlist] submitToWaitlist:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
