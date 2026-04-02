import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { syncGmailForUser } from "@/app/actions/gmail-sync";

export async function POST() {
  console.log("[gmail/sync] POST received");
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncGmailForUser();
  console.log("[gmail/sync] sync result:", result);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    processed: result.processed,
    imported: result.imported,
  });
}
