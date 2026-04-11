import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateDailyBriefing } from "@/app/actions/agent";
import { DEFAULT_BRIEFING_TIMEZONE } from "@/lib/agent/briefing";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateDailyBriefing(
    userId,
    DEFAULT_BRIEFING_TIMEZONE,
  );

  return NextResponse.json({
    briefing: result?.briefing ?? null,
    suggestedReplies: result?.suggestedReplies ?? [],
  });
}
