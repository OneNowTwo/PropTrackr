import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isValidPropertyId } from "@/lib/db/queries";
import { getGmailConnectionForUserId } from "@/lib/db/gmail-queries";
import { documents, gmailConnections } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";
import { fetchAttachmentData } from "@/lib/gmail/gmail-api";
import { refreshAccessToken } from "@/lib/gmail/google-token";

async function ensureAccessForUser(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<string | null> {
  const conn = await getGmailConnectionForUserId(userId);
  if (!conn) return null;
  if (conn.tokenExpiry.getTime() > Date.now() + 60_000) {
    return conn.accessToken;
  }
  const tokens = await refreshAccessToken(conn.refreshToken);
  const expiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(gmailConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
      tokenExpiry: expiry,
    })
    .where(eq(gmailConnections.id, conn.id));
  return tokens.access_token;
}

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const docId = url.searchParams.get("id");
  if (!docId || !isValidPropertyId(docId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const full = await currentUser();
  const email = full?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await getOrCreateUserByClerkId({
    clerkId,
    email,
    name: full?.fullName ?? null,
  });

  const db = getDb();
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, dbUser.id)))
    .limit(1);

  if (!doc?.gmailMessageId || !doc.gmailAttachmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await ensureAccessForUser(db, dbUser.id);
  if (!access) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  try {
    const buf = await fetchAttachmentData(
      access,
      doc.gmailMessageId,
      doc.gmailAttachmentId,
    );
    const mime = doc.fileType || "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
