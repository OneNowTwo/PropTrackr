import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  extractListingFromProvidedHtml,
  extractListingFromUrl,
  type ExtractedListingFields,
} from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";
import {
  enrichPropertyInBackground,
  type DomAgentPayload,
} from "@/app/lib/enrichment/enrich-property";
import { getDb } from "@/lib/db";
import { coerceNotesSummary } from "@/lib/listing/coerce-claude-json-string";
import { insertInspectionSlotsForProperty } from "@/lib/listing/inspection-autofill";

export const dynamic = "force-dynamic";

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  // Browsers disallow `*` with credentials; echo the chrome-extension origin.
  if (/^chrome-extension:\/\//i.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function parseOptionalIntString(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDomAgentsFromBody(body: unknown): DomAgentPayload[] {
  if (!body || typeof body !== "object" || !("agents" in body)) return [];
  const raw = (body as { agents: unknown }).agents;
  if (!Array.isArray(raw)) return [];
  const out: DomAgentPayload[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const phone =
      typeof o.phone === "string" && o.phone.trim()
        ? o.phone.trim()
        : undefined;
    const photo =
      typeof o.photo === "string" && o.photo.trim()
        ? o.photo.trim()
        : undefined;
    out.push({ name, phone, photo });
  }
  return out;
}

function resolveUrlAgainstPage(
  href: string | undefined,
  pageUrl: string,
): string | undefined {
  const t = (href ?? "").trim();
  if (!t) return undefined;
  try {
    return new URL(t, pageUrl).href;
  } catch {
    return undefined;
  }
}

function normalizeDomAgentsForSave(
  body: unknown,
  pageUrl: string,
): DomAgentPayload[] {
  return parseDomAgentsFromBody(body).map((a) => ({
    name: a.name,
    phone: a.phone,
    photo: resolveUrlAgainstPage(a.photo, pageUrl) ?? a.photo,
  }));
}

function applyDomAgentsToExtracted(
  data: ExtractedListingFields,
  domAgents: DomAgentPayload[],
): ExtractedListingFields {
  if (domAgents.length === 0) return data;
  const a = domAgents[0]!;
  return {
    ...data,
    ...(a.name?.trim() ? { agentName: a.name.trim() } : {}),
    ...(a.phone?.trim() ? { agentPhone: a.phone.trim() } : {}),
    ...(a.photo?.trim() ? { agentPhotoUrl: a.photo.trim() } : {}),
  };
}

function extractedToPropertyInput(
  d: ExtractedListingFields,
  listingUrl: string,
) {
  const url = (d.listingUrl || listingUrl).trim();
  const imageExtras = (d.imageUrls ?? []).filter((u) => u && u !== d.imageUrl);
  const notesStr = coerceNotesSummary(d.notes).trim();
  return {
    address: d.address.trim(),
    suburb: d.suburb.trim(),
    state: d.state,
    postcode: d.postcode,
    price: parseOptionalIntString(d.price),
    bedrooms: parseOptionalIntString(d.bedrooms),
    bathrooms: parseOptionalIntString(d.bathrooms),
    parking: parseOptionalIntString(d.parking),
    propertyType: d.propertyType?.trim() ? d.propertyType : null,
    listingUrl: url,
    imageUrl: d.imageUrl?.trim() || null,
    imageUrls: imageExtras.length > 0 ? imageExtras : null,
    notes: notesStr || null,
    agentName: d.agentName?.trim() || null,
    agencyName: d.agencyName?.trim() || null,
    agentPhotoUrl: d.agentPhotoUrl?.trim() || null,
    agentEmail: d.agentEmail?.trim() || null,
    agentPhone: d.agentPhone?.trim() || null,
    auctionDate: d.auctionDate?.trim() || null,
    auctionTime: d.auctionTime?.trim() || null,
    auctionVenue: d.auctionVenue?.trim() || null,
    propertyStatus: "saved" as const,
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const originAllowed = !!headers["Access-Control-Allow-Origin"];

  const jsonError = (status: number, body: Record<string, unknown>) =>
    NextResponse.json(body, { status, headers });

  if (!originAllowed) {
    return jsonError(403, {
      ok: false,
      error: "Invalid extension origin for CORS.",
    });
  }

  const { userId } = await auth();
  if (!userId) {
    return jsonError(401, {
      ok: false,
      error: "Please log in to PropTrackr first",
    });
  }

  const clerkUser = await currentUser();
  if (!clerkUser?.emailAddresses?.[0]?.emailAddress) {
    return jsonError(401, {
      ok: false,
      error: "Please log in to PropTrackr first",
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, { ok: false, error: "Invalid JSON body." });
  }

  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";

  if (!url) {
    return jsonError(400, { ok: false, error: "Missing or invalid url." });
  }

  try {
    new URL(url);
  } catch {
    return jsonError(400, { ok: false, error: "url must be a valid URL." });
  }

  const htmlRaw =
    typeof body === "object" &&
    body !== null &&
    "html" in body &&
    typeof (body as { html: unknown }).html === "string"
      ? (body as { html: string }).html
      : undefined;

  const domAgents =
    htmlRaw != null && htmlRaw.length > 0
      ? normalizeDomAgentsForSave(body, url)
      : [];

  const extracted =
    htmlRaw != null && htmlRaw.length > 0
      ? await extractListingFromProvidedHtml(url, htmlRaw)
      : await extractListingFromUrl(url);
  if (!extracted.ok) {
    return jsonError(422, { ok: false, error: extracted.error });
  }

  const listingDataForSave =
    domAgents.length > 0
      ? applyDomAgentsToExtracted(extracted.data, domAgents)
      : extracted.data;

  if (htmlRaw != null && htmlRaw.length > 0) {
    const d = listingDataForSave;
    console.log(
      "[extension] route extract ok:",
      JSON.stringify({
        address: d.address,
        imageUrl: d.imageUrl,
        imageUrlsCount: d.imageUrls?.length,
        agentName: d.agentName,
        domAgentOverrides: domAgents.length > 0,
        inspectionDatesCount: d.inspectionDates?.length ?? 0,
      }),
    );
  }

  const input = extractedToPropertyInput(listingDataForSave, url);
  if (!input.address || !input.suburb) {
    return jsonError(422, {
      ok: false,
      error:
        "Could not read a full address from this page. Open the listing in PropTrackr and save from there.",
    });
  }

  const created = await createPropertyRecordForUser(input);
  if (!created.ok) {
    const status =
      created.error === "You must be signed in." ? 401 : 400;
    return jsonError(status, { ok: false, error: created.error });
  }

  const inspectionSlots = extracted.data.inspectionDates ?? [];
  if (inspectionSlots.length > 0 && clerkUser.emailAddresses[0]?.emailAddress) {
    const db = getDb();
    await insertInspectionSlotsForProperty(
      db,
      created.userId,
      created.id,
      inspectionSlots,
    );
    revalidatePath("/planner");
    revalidatePath(`/properties/${created.id}`);
  }

  if (htmlRaw != null && htmlRaw.length > 0) {
    void enrichPropertyInBackground({
      propertyId: created.id,
      userId: created.userId,
      clerkUserId: userId,
      rawHtml: htmlRaw,
      address: created.address,
      suburb: extracted.data.suburb,
      agencyName: extracted.data.agencyName ?? "",
      listingUrl: extracted.data.listingUrl || url,
      domAgents: domAgents.length > 0 ? domAgents : undefined,
    }).catch((err) => console.error("[enrich] background error:", err));
  }

  return NextResponse.json(
    {
      ok: true,
      propertyId: created.id,
      address: created.address,
    },
    { status: 200, headers },
  );
}
