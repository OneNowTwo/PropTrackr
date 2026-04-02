"use server";

import { randomUUID } from "crypto";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getAnthropic } from "@/lib/anthropic";
import { getDb } from "@/lib/db";
import { resolveOrCreateAgentId } from "@/lib/db/agent-sync";
import { getGmailConnectionForUserId } from "@/lib/db/gmail-queries";
import {
  agents,
  documents,
  gmailConnections,
  properties,
  propertyEmails,
  users,
} from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import {
  getMessageFull,
  listMessageIds,
  type ParsedGmailMessage,
} from "@/lib/gmail/gmail-api";
import { refreshAccessToken } from "@/lib/gmail/google-token";

import { isValidPropertyId } from "@/lib/db/queries";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/** Gmail list query: sender or subject signals, last 90 days (optionally narrowed by after:). */
const GMAIL_SYNC_BASE_QUERY =
  '(from:raywhite OR from:ljhooker OR from:mcgrath OR from:domain.com.au OR from:realestate.com.au OR from:laing OR from:belle OR subject:"open home" OR subject:"inspection" OR subject:"auction" OR subject:"contract of sale" OR subject:"property" OR subject:"for sale" OR subject:"settlement" OR subject:"offer") newer_than:90d';

const KNOWN_RE_DOMAIN_MARKERS = [
  "raywhite",
  "ljhooker",
  "mcgrath",
  "domain.com.au",
  "realestate.com.au",
  "laing",
  "belleproperty",
  "belle.com.au",
  "cooley",
  "phillips",
  "cunninghams",
  "harcourts",
  "century21",
  "raineandhorne",
  "firstnational",
  "obrien.com.au",
  "stockdale",
  "barryplant",
  "jelliscraig",
  "marshallwhite",
  "place.com.au",
  "ljh.com.au",
  "coronis",
  "williamsrealestate",
  "hodges",
  "woodards",
  "gnbre",
] as const;

const RE_SUBJECT_PHRASES = [
  "open home",
  "inspection",
  "auction",
  "contract of sale",
  "for sale",
  "settlement",
  "offer accepted",
  "property",
  "listing",
  "agent",
] as const;

const BLOCKED_NON_RE_DOMAINS = [
  "seek.com",
  "linkedin.com",
  "indeed.com",
  "facebook.com",
  "fb.com",
  "google.com",
  "apple.com",
  "microsoft.com",
  "twitter.com",
  "x.com",
  "amazon.com",
  "netflix.com",
  "spotify.com",
  "mailchimp.com",
  "zendesk.com",
] as const;

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function emailHost(fromEmail: string): string {
  const at = fromEmail.lastIndexOf("@");
  if (at < 0) return "";
  return fromEmail.slice(at + 1).toLowerCase().trim();
}

function isBlockedNonReSender(host: string): boolean {
  if (!host) return true;
  for (const b of BLOCKED_NON_RE_DOMAINS) {
    if (host === b || host.endsWith(`.${b}`)) return true;
  }
  return false;
}

function isKnownRealEstateDomain(host: string): boolean {
  if (!host) return false;
  return KNOWN_RE_DOMAIN_MARKERS.some((m) => host.includes(m));
}

function subjectHasRealEstatePhrases(subject: string): boolean {
  const s = subject.toLowerCase();
  return RE_SUBJECT_PHRASES.some((p) => s.includes(p));
}

/** Post-fetch gate: not a known junk sender, and agency-like domain or RE subject phrases. */
function passesRealEstateSecondaryFilter(
  fromEmail: string,
  subject: string,
): boolean {
  const host = emailHost(fromEmail);
  if (isBlockedNonReSender(host)) return false;
  return (
    isKnownRealEstateDomain(host) || subjectHasRealEstatePhrases(subject)
  );
}

function buildGmailSyncQuery(lastSyncedAt: Date | null): string {
  if (!lastSyncedAt) return GMAIL_SYNC_BASE_QUERY;
  const d = new Date(lastSyncedAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${GMAIL_SYNC_BASE_QUERY} after:${y}/${m}/${day}`;
}

function matchProperty(
  combined: string,
  props: (typeof properties.$inferSelect)[],
): string | null {
  const t = normalizeText(combined);
  for (const p of props) {
    const addr = normalizeText(p.address);
    if (addr.length >= 8 && t.includes(addr)) return p.id;
  }
  return null;
}

function domainKey(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return "";
  const host = email.slice(at + 1).split(".")[0] ?? "";
  return host.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function agencyKey(agency: string | null): string {
  if (!agency) return "";
  return agency.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function matchAgentByEmail(
  fromEmail: string,
  agentRows: (typeof agents.$inferSelect)[],
): string | null {
  const e = fromEmail.toLowerCase();
  for (const a of agentRows) {
    if (a.email?.trim().toLowerCase() === e) return a.id;
  }
  return null;
}

function matchAgentByDomain(
  fromEmail: string,
  agentRows: (typeof agents.$inferSelect)[],
): string | null {
  const dk = domainKey(fromEmail);
  if (dk.length < 3) return null;
  for (const a of agentRows) {
    const ak = agencyKey(a.agencyName);
    if (ak.length >= 4 && (ak.includes(dk) || dk.includes(ak.slice(0, 6)))) {
      return a.id;
    }
  }
  return null;
}

type AnalysisJson = {
  summary?: string;
  actionItems?: string[];
  inspectionTime?: string | null;
  price?: string | null;
  documentsRequested?: string[];
};

function parseJsonObject(raw: string): AnalysisJson {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as AnalysisJson;
  } catch {
    return {};
  }
}

async function analyzeEmailWithClaude(
  subject: string,
  body: string,
): Promise<AnalysisJson> {
  try {
    const anthropic = getAnthropic();
    const prompt = `Analyse this real estate email and extract:
1. Summary (2-3 sentences)
2. Action items for the buyer (if any)
3. Any inspection times mentioned
4. Any price information
5. Any documents requested

Return ONLY valid JSON in this exact shape (no markdown):
{"summary":"...","actionItems":["..."],"inspectionTime":null or string,"price":null or string,"documentsRequested":["..."]}

Subject: ${subject}

Body:
${body.slice(0, 12000)}`;
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    if (block.type !== "text") return {};
    return parseJsonObject(block.text);
  } catch {
    return {};
  }
}

type SignatureJson = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  agency?: string | null;
};

async function extractSignatureWithClaude(
  body: string,
): Promise<SignatureJson> {
  try {
    const anthropic = getAnthropic();
    const prompt = `From this email body, extract the sender's professional signature details if present. Return ONLY JSON:
{"name":string|null,"email":string|null,"phone":string|null,"agency":string|null}

Body:
${body.slice(0, 8000)}`;
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    if (block.type !== "text") return {};
    return parseJsonObject(block.text) as SignatureJson;
  } catch {
    return {};
  }
}

async function ensureAccessToken(
  db: ReturnType<typeof getDb>,
  row: typeof gmailConnections.$inferSelect,
): Promise<string> {
  if (row.tokenExpiry.getTime() > Date.now() + 60_000) {
    return row.accessToken;
  }
  const tokens = await refreshAccessToken(row.refreshToken);
  const expiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(gmailConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? row.refreshToken,
      tokenExpiry: expiry,
    })
    .where(eq(gmailConnections.id, row.id));
  return tokens.access_token;
}

export type SyncGmailResult =
  | { ok: true; processed: number; imported: number }
  | { ok: false; error: string };

export async function syncGmailForUser(): Promise<SyncGmailResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "Not signed in." };
  console.log("[gmail-sync] starting sync for user:", clerkId);

  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "Database not configured." };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return { ok: false, error: "Account needs an email." };

  try {
    const dbUser = await getOrCreateUserByClerkId({
      clerkId,
      email,
      name: clerkUser?.fullName ?? null,
    });
    const conn = await getGmailConnectionForUserId(dbUser.id);
    if (!conn) return { ok: false, error: "Gmail is not connected." };

    console.log("[gmail-sync] gmail connection found:", conn.gmailEmail);

    const db = getDb();
    const access = await ensureAccessToken(db, conn);

    const props = await db
      .select()
      .from(properties)
      .where(eq(properties.userId, dbUser.id));
    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, dbUser.id));

    const q = buildGmailSyncQuery(conn.lastSyncedAt);
    console.log("[gmail-sync] fetching messages from Gmail API");
    const ids = await listMessageIds(access, q, 35);
    const messageCount = ids.length;
    console.log("[gmail-sync] messages found:", messageCount);
    let imported = 0;

    for (const { id: msgId } of ids) {
      let parsed: ParsedGmailMessage;
      try {
        parsed = await getMessageFull(access, msgId);
      } catch {
        continue;
      }

      const [existing] = await db
        .select({ id: propertyEmails.id })
        .from(propertyEmails)
        .where(eq(propertyEmails.gmailMessageId, parsed.id))
        .limit(1);
      if (existing) continue;

      if (!passesRealEstateSecondaryFilter(parsed.fromEmail, parsed.subject)) {
        console.log(
          "[gmail-sync] skipping non-RE email:",
          parsed.subject,
          parsed.fromEmail,
        );
        continue;
      }

      console.log(
        "[gmail-sync] processing message:",
        parsed.id,
        parsed.subject,
      );

      const combined = `${parsed.subject}\n${parsed.bodyText}`;
      let propertyId: string | null = matchProperty(combined, props);
      let agentId =
        matchAgentByEmail(parsed.fromEmail, agentRows) ??
        matchAgentByDomain(parsed.fromEmail, agentRows);

      const analysis = await analyzeEmailWithClaude(
        parsed.subject,
        parsed.bodyText,
      );
      const summary = analysis.summary?.trim() || null;
      const actionItems =
        Array.isArray(analysis.actionItems) && analysis.actionItems.length
          ? analysis.actionItems.filter((x) => typeof x === "string")
          : null;

      const insertResult = await db
        .insert(propertyEmails)
        .values({
          userId: dbUser.id,
          propertyId,
          agentId,
          gmailMessageId: parsed.id,
          threadId: parsed.threadId,
          fromEmail: parsed.fromEmail,
          fromName: parsed.fromName,
          subject: parsed.subject,
          bodyText: parsed.bodyText || null,
          bodyHtml: parsed.bodyHtml,
          receivedAt: parsed.receivedAt,
          isRead: !parsed.labelIds?.includes("UNREAD"),
          aiSummary: summary,
          actionItems,
        })
        .onConflictDoNothing({ target: propertyEmails.gmailMessageId })
        .returning({ id: propertyEmails.id });

      if (!insertResult.length) continue;
      imported += 1;

      const sig = await extractSignatureWithClaude(parsed.bodyText);
      if (!agentId && (sig.name || sig.email || sig.agency)) {
        const newAgentId = await resolveOrCreateAgentId(db, dbUser.id, {
          agentName: sig.name ?? null,
          agencyName: sig.agency ?? null,
          agentPhotoUrl: null,
          agentEmail: sig.email ?? parsed.fromEmail,
          agentPhone: sig.phone ?? null,
        });
        if (newAgentId) {
          agentId = newAgentId;
          await db
            .update(propertyEmails)
            .set({ agentId })
            .where(eq(propertyEmails.gmailMessageId, parsed.id));
        }
      } else if (agentId && (sig.phone || sig.email || sig.agency)) {
        const patch: {
          phone?: string;
          email?: string;
          agencyName?: string;
          updatedAt: Date;
        } = { updatedAt: new Date() };
        const [existing] = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, agentId), eq(agents.userId, dbUser.id)))
          .limit(1);
        if (existing) {
          if (sig.phone?.trim() && !existing.phone?.trim()) {
            patch.phone = sig.phone.trim();
          }
          if (sig.email?.trim() && !existing.email?.trim()) {
            patch.email = sig.email.trim();
          }
          if (sig.agency?.trim() && !existing.agencyName?.trim()) {
            patch.agencyName = sig.agency.trim();
          }
          const keys = Object.keys(patch).filter((k) => k !== "updatedAt");
          if (keys.length > 0) {
            await db.update(agents).set(patch).where(eq(agents.id, agentId));
          }
        }
      }

      if (propertyId && parsed.parts.length) {
        for (const part of parsed.parts) {
          const fn = part.filename?.trim() || "attachment";
          const aid = part.body?.attachmentId;
          if (!aid) continue;
          const docId = randomUUID();
          const fileUrl = `/api/gmail/file?id=${docId}`;
          try {
            await db.insert(documents).values({
              id: docId,
              propertyId,
              userId: dbUser.id,
              fileUrl,
              fileName: fn,
              fileType: part.mimeType ?? null,
              gmailMessageId: parsed.id,
              gmailAttachmentId: aid,
            });
          } catch {
            /* duplicate or FK */
          }
        }
      }
    }

    await db
      .update(gmailConnections)
      .set({ lastSyncedAt: new Date() })
      .where(eq(gmailConnections.id, conn.id));

    revalidatePath("/dashboard");
    revalidatePath("/account");
    revalidatePath("/agents");
    revalidatePath("/properties");

    console.log(
      "[gmail-sync] sync complete - processed:",
      ids.length,
      "emails",
    );
    return { ok: true, processed: ids.length, imported };
  } catch (e) {
    console.error("[gmail-sync] error:", e);
    const message = e instanceof Error ? e.message : "Sync failed.";
    return { ok: false, error: message };
  }
}

export async function assignPropertyEmailToProperty(
  emailRowId: string,
  propertyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "Not signed in." };
  if (!isValidPropertyId(propertyId) || !isValidPropertyId(emailRowId)) {
    return { ok: false, error: "Invalid id." };
  }

  try {
    const db = getDb();
    const clerkUser = await currentUser();
    const em = clerkUser?.emailAddresses[0]?.emailAddress;
    if (!em) return { ok: false, error: "Account needs an email." };
    const dbUser = await getOrCreateUserByClerkId({
      clerkId,
      email: em,
      name: clerkUser?.fullName ?? null,
    });

    const [prop] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
      )
      .limit(1);
    if (!prop) return { ok: false, error: "Property not found." };

    const updated = await db
      .update(propertyEmails)
      .set({ propertyId })
      .where(
        and(
          eq(propertyEmails.id, emailRowId),
          eq(propertyEmails.userId, dbUser.id),
        ),
      )
      .returning({ id: propertyEmails.id });

    if (!updated.length) return { ok: false, error: "Email not found." };

    revalidatePath("/account");
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not assign.";
    return { ok: false, error: message };
  }
}
