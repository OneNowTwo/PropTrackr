import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { extractListingFromUrl } from "@/app/actions/listings";
import { getDb } from "@/lib/db";
import { resolveOrCreateAgentId } from "@/lib/db/agent-sync";
import { agents, properties } from "@/lib/db/schema";
import { getAnthropic } from "@/lib/anthropic";
import { coerceNotesSummary } from "@/lib/listing/coerce-claude-json-string";

const REA_AGENT_URL_RE =
  /https:\/\/www\.realestate\.com\.au\/agent\/[a-z0-9-]+-\d+/gi;

const HAIKU_MODEL = "claude-3-haiku-20240307";

const JINA_FETCH_MS = 55_000;
const DIRECT_FETCH_MS = 22_000;

/** Same as app/actions/listings.ts — direct HTML fetch when Jina is blocked/empty. */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
} as const;

/** Agent rows from extension DOM scrape (photo may be resolved to absolute URL in the API route). */
export type DomAgentPayload = {
  name?: string;
  phone?: string;
  photo?: string;
};

export type EnrichPropertyBackgroundParams = {
  propertyId: string;
  userId: string;
  clerkUserId: string;
  rawHtml: string;
  address: string;
  suburb: string;
  agencyName: string;
  listingUrl: string;
  /** Starting point for name/phone/photo before REA profile fetch adds agency site. */
  domAgents?: DomAgentPayload[];
};

type AgentProfileJson = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  agencyWebsiteUrl?: string | null;
};

type ListingUrlJson = {
  listingUrl?: string | null;
};

function fillEmpty(
  current: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const c = (current ?? "").trim();
  const n = (incoming ?? "").trim();
  if (c) return c;
  return n || null;
}

function imageSizeScore(u: string): number {
  const s = u.toLowerCase();
  if (/\b1200x\d+|\d+x1200\b|\/1200x|\b1200w\b/i.test(s)) return 100;
  if (/\b1000x\d+|\d+x1000\b|\/1000x/i.test(s)) return 96;
  if (/\b1280x|\d+x1280\b/i.test(s)) return 95;
  if (/\b800x\d+|\d+x800\b|\/800x|\b800w\b/i.test(s)) return 90;
  if (/\b640x|\d+x640\b|\b720x/i.test(s)) return 70;
  if (/\b400x\d+|\d+x400\b|\/400x/i.test(s)) return 40;
  if (/\b360x\d+|\d+x360\b|\/360x/i.test(s)) return 30;
  return 50;
}

function canonicalImageHref(u: string): string {
  try {
    return new URL(u.trim()).href;
  } catch {
    return u.trim();
  }
}

function mergePropertyImages(
  existingHero: string | null,
  existingExtras: string[] | null,
  newHero: string | null,
  newExtras: string[],
): { imageUrl: string | null; imageUrls: string[] | null } {
  const all: string[] = [];
  for (const x of [
    existingHero,
    ...(existingExtras ?? []),
    newHero,
    ...newExtras,
  ]) {
    const t = (x ?? "").trim();
    if (t) all.push(t);
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const u of all) {
    const k = canonicalImageHref(u);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(u.trim());
  }
  unique.sort((a, b) => imageSizeScore(b) - imageSizeScore(a));
  const top = unique.slice(0, 8);
  const hero = top[0] ?? null;
  const rest = top.slice(1);
  return {
    imageUrl: hero,
    imageUrls: rest.length > 0 ? rest : null,
  };
}

async function fetchViaJina(targetUrl: string): Promise<string | null> {
  const trimmed = targetUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const readerUrl = `https://r.jina.ai/${trimmed}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), JINA_FETCH_MS);
  try {
    const res = await fetch(readerUrl, {
      signal: ac.signal,
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "markdown",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaBrowser(
  targetUrl: string,
): Promise<{ text: string; status: number } | null> {
  const trimmed = targetUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DIRECT_FETCH_MS);
  try {
    const res = await fetch(trimmed, {
      signal: ac.signal,
      redirect: "follow",
      headers: { ...BROWSER_HEADERS },
    });
    const text = await res.text();
    if (!text.trim()) return null;
    return { text, status: res.status };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jina reader first; if empty or failed, direct fetch with browser headers (REA agent pages often block Jina).
 */
async function fetchJinaMarkdown(targetUrl: string): Promise<string | null> {
  const jina = await fetchViaJina(targetUrl);
  if (jina && jina.trim().length > 0) return jina;
  const direct = await fetchViaBrowser(targetUrl);
  return direct && direct.text.trim().length > 0 ? direct.text : null;
}

async function fetchAgentProfileForEnrichment(
  agentUrl: string,
): Promise<string | null> {
  console.log("[enrich] fetching agent profile:", agentUrl);

  let text: string | null = await fetchViaJina(agentUrl);
  if (!text?.trim()) {
    console.log(
      "[enrich] Jina empty or failed for agent profile, trying direct browser fetch",
    );
    const direct = await fetchViaBrowser(agentUrl);
    console.log(
      "[enrich] agent direct fetch status:",
      direct?.status ?? "(no response)",
    );
    text = direct?.text ?? null;
  }

  const body = text ?? "";
  console.log("[enrich] agent profile response length:", body.length);
  console.log("[enrich] agent profile first 500 chars:", body.slice(0, 500));

  return body.trim().length > 0 ? body : null;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonObject<T extends Record<string, unknown>>(
  raw: string,
): T | null {
  const slice = extractFirstJsonObject(raw);
  if (!slice) return null;
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}

async function haikuExtractJson<T extends Record<string, unknown>>(
  system: string,
  user: string,
): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1200,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content.find((b) => b.type === "text");
    const text =
      block && block.type === "text" ? block.text.trim() : "";
    if (!text) return null;
    return parseJsonObject<T>(text);
  } catch (e) {
    console.error("[enrich] haiku error:", e);
    return null;
  }
}

function normalizeExternalAgencyUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    if (!/^https?:$/i.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (
      h.includes("realestate.com.au") ||
      h.includes("rea.group") ||
      h === "rea.au"
    ) {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

async function extractReaAgentProfileFromMarkdown(
  pageText: string,
): Promise<AgentProfileJson | null> {
  const system =
    "You extract structured data from Australian real estate agent profile page content (HTML or plain text). Return ONLY valid JSON, no markdown fences.";
  const user = `Extract from this REA agent profile page:
- Agent full name
- Phone number
- Email
- Profile photo URL (absolute https if present)
- Agency website URL (their personal agency site, not realestate.com.au)

Page content:
---
${pageText.slice(0, 80_000)}
---

Return JSON: {"name","phone","email","photoUrl","agencyWebsiteUrl"} Use null for unknown fields.`;
  return haikuExtractJson<AgentProfileJson>(system, user);
}

async function findAgencyListingUrlFromMarkdown(
  markdown: string,
  addressQuery: string,
): Promise<string | null> {
  const system =
    "You find listing URLs on real estate agency websites. Return ONLY valid JSON, no markdown fences.";
  const user = `Find the listing URL for this property on this agency page content.

Property: ${addressQuery}

Page text:
---
${markdown.slice(0, 90_000)}
---

Return JSON: {"listingUrl":"https://..."} or {"listingUrl":null} if not found. The URL must be http(s) on the agency's own domain.`;
  const parsed = await haikuExtractJson<ListingUrlJson>(system, user);
  const u = (parsed?.listingUrl ?? "").trim();
  if (!u || u === "null") return null;
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Background enrichment: REA agent profiles → agency site → full extract → DB merge.
 * Never throws or rejects; all errors are swallowed (defer with setTimeout from the route).
 */
export async function enrichPropertyInBackground(
  params: EnrichPropertyBackgroundParams,
): Promise<void> {
  try {
    const {
      propertyId,
      userId,
      rawHtml,
      address,
      suburb,
      agencyName,
      domAgents = [],
    } = params;

    const addressLine = [address, suburb].filter(Boolean).join(", ").trim();

    console.log("[enrich] starting for property:", addressLine);

    if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) {
      console.log("[enrich] skip: missing DATABASE_URL or ANTHROPIC_API_KEY");
      return;
    }

    const html = String(rawHtml ?? "");
    if (html.length < 200) {
      console.log("[enrich] skip: raw HTML too short");
      return;
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(properties)
      .where(
        and(eq(properties.id, propertyId), eq(properties.userId, userId)),
      )
      .limit(1);

    if (!row) {
      console.log("[enrich] skip: property not found", propertyId);
      return;
    }

    const agentMatches = Array.from(html.matchAll(REA_AGENT_URL_RE)).map(
      (m) => m[0],
    );
    const uniqueAgentUrls = Array.from(new Set(agentMatches));
    console.log(
      "[enrich] found agent profile URLs:",
      uniqueAgentUrls.length,
      uniqueAgentUrls.slice(0, 3),
    );

    let mergedProfile: AgentProfileJson = {};
    const dom0 = domAgents[0];
    if (dom0) {
      const n = (dom0.name ?? "").trim();
      const p = (dom0.phone ?? "").trim();
      const ph = (dom0.photo ?? "").trim();
      if (n) mergedProfile.name = n;
      if (p) mergedProfile.phone = p;
      if (ph) mergedProfile.photoUrl = ph;
      if (n || p || ph) {
        console.log(
          "[enrich] DOM agent seed (first):",
          JSON.stringify({ name: n || undefined, phone: p || undefined, photoUrl: ph || undefined }),
        );
      }
    }

    let agencyOrigin: string | null = null;

    for (const agentUrl of uniqueAgentUrls.slice(0, 4)) {
      const page = await fetchAgentProfileForEnrichment(agentUrl);
      if (!page) continue;
      const profile = await extractReaAgentProfileFromMarkdown(page);
      if (!profile) continue;
      mergedProfile = { ...mergedProfile, ...profile };
      const site = normalizeExternalAgencyUrl(profile.agencyWebsiteUrl ?? null);
      if (site) agencyOrigin = site;
      if (agencyOrigin && (profile.name || profile.phone)) break;
    }

    const nameLog = (mergedProfile.name ?? "").trim() || "(none)";
    const phoneLog = (mergedProfile.phone ?? "").trim() || "(none)";
    console.log("[enrich] agent details extracted:", nameLog, phoneLog);
    console.log("[enrich] agency website:", agencyOrigin ?? "(none)");

    let agencyListingUrl: string | null = null;
    if (agencyOrigin) {
      const q = encodeURIComponent(addressLine);
      const candidates = [
        `${agencyOrigin}/properties/for-sale`,
        `${agencyOrigin}/buy`,
        `${agencyOrigin}/listings`,
        `${agencyOrigin}/search?q=${q}`,
        `${agencyOrigin}?q=${q}`,
      ];
      for (const pageUrl of candidates) {
        const pageMd = await fetchJinaMarkdown(pageUrl);
        if (!pageMd || pageMd.length < 150) continue;
        agencyListingUrl = await findAgencyListingUrlFromMarkdown(
          pageMd,
          addressLine,
        );
        if (agencyListingUrl) break;
      }
    }

    console.log("[enrich] agency listing URL found:", agencyListingUrl ?? "(none)");

    let enrichedExtract: Awaited<ReturnType<typeof extractListingFromUrl>> | null =
      null;
    if (agencyListingUrl) {
      enrichedExtract = await extractListingFromUrl(agencyListingUrl);
      if (enrichedExtract.ok) {
        const imgs =
          (enrichedExtract.data.imageUrl ? 1 : 0) +
          (enrichedExtract.data.imageUrls?.length ?? 0);
        console.log("[enrich] full extraction complete:", imgs, "images");
      } else {
        console.log(
          "[enrich] full extraction failed:",
          enrichedExtract.error,
        );
      }
    }

    const d = enrichedExtract?.ok ? enrichedExtract.data : null;

    const mergedNotes = (() => {
      const existing = (row.notes ?? "").trim();
      const incoming = d ? coerceNotesSummary(d.notes).trim() : "";
      if (!incoming) return row.notes ?? null;
      if (!existing) return incoming;
      return incoming.length > existing.length ? incoming : existing;
    })();

    const { imageUrl: nextHero, imageUrls: nextExtras } = mergePropertyImages(
      row.imageUrl,
      row.imageUrls,
      d?.imageUrl?.trim() || null,
      d?.imageUrls ?? [],
    );

    const nextAgentName = fillEmpty(row.agentName, mergedProfile.name ?? d?.agentName);
    const nextAgentPhone = fillEmpty(
      row.agentPhone,
      mergedProfile.phone ?? d?.agentPhone,
    );
    const nextAgentEmail = fillEmpty(
      row.agentEmail,
      mergedProfile.email ?? d?.agentEmail,
    );
    const nextAgentPhoto = fillEmpty(
      row.agentPhotoUrl,
      mergedProfile.photoUrl ?? d?.agentPhotoUrl,
    );
    const nextAgencyName = fillEmpty(
      row.agencyName,
      d?.agencyName ?? (agencyName || null),
    );

    const hasProfileData = Object.values(mergedProfile).some(
      (v) => v != null && String(v).trim().length > 0,
    );
    if (!d && !hasProfileData) {
      console.log("[enrich] no enrichment data to persist");
      return;
    }

    let agentId = row.agentId;
    if (!agentId && (nextAgentName || nextAgentPhone || nextAgentEmail)) {
      agentId = await resolveOrCreateAgentId(db, userId, {
        agentName: nextAgentName,
        agencyName: nextAgencyName,
        agentPhotoUrl: nextAgentPhoto,
        agentEmail: nextAgentEmail,
        agentPhone: nextAgentPhone,
      });
    } else if (agentId) {
      const [agentRow] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);
      if (agentRow) {
        const nextName =
          fillEmpty(agentRow.name, nextAgentName) ?? agentRow.name;
        await db
          .update(agents)
          .set({
            name: nextName.trim() ? nextName.trim() : agentRow.name,
            email: fillEmpty(agentRow.email, nextAgentEmail),
            phone: fillEmpty(agentRow.phone, nextAgentPhone),
            photoUrl: fillEmpty(agentRow.photoUrl, nextAgentPhoto),
            agencyName: fillEmpty(agentRow.agencyName, nextAgencyName),
            updatedAt: new Date(),
          })
          .where(eq(agents.id, agentId));
      }
    }

    await db
      .update(properties)
      .set({
        agentId,
        imageUrl: nextHero,
        imageUrls: nextExtras,
        notes: mergedNotes,
        agentName: nextAgentName,
        agentPhone: nextAgentPhone,
        agentEmail: nextAgentEmail,
        agentPhotoUrl: nextAgentPhoto,
        agencyName: nextAgencyName,
        updatedAt: new Date(),
      })
      .where(
        and(eq(properties.id, propertyId), eq(properties.userId, userId)),
      );

    revalidatePath("/properties");
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath("/agents");
    if (agentId) {
      revalidatePath(`/agents/${agentId}`);
    }

    console.log("[enrich] property updated with enriched data");
  } catch {
    /* never throw — background enrichment must not affect the save response */
  }
}
