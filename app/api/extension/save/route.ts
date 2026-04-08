import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  extractListingFromProvidedHtml,
  extractListingFromUrl,
  type ExtractedListingFields,
} from "@/app/actions/listings";
import { createPropertyRecordForUser } from "@/app/actions/properties";

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

function coerceNotesSummary(notesSummary: unknown): string {
  return typeof notesSummary === "string"
    ? notesSummary
    : Array.isArray(notesSummary)
      ? notesSummary.join("\n")
      : String(notesSummary ?? "");
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

  const extracted =
    htmlRaw != null && htmlRaw.length > 0
      ? await extractListingFromProvidedHtml(url, htmlRaw)
      : await extractListingFromUrl(url);
  if (!extracted.ok) {
    return jsonError(422, { ok: false, error: extracted.error });
  }

  const input = extractedToPropertyInput(extracted.data, url);
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

  return NextResponse.json(
    {
      ok: true,
      propertyId: created.id,
      address: created.address,
    },
    { status: 200, headers },
  );
}
