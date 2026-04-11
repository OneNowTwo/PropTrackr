import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  generateAgentOneLiners,
  generatePropertyOneLiners,
  generateSuburbOneLiners,
} from "@/app/actions/agent";
import { loadCommandCentreOneLinerInputs } from "@/lib/agent/command-centre-one-liner-inputs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inputs = await loadCommandCentreOneLinerInputs(userId);

  const [propertyOneLiners, agentOneLiners, suburbOneLiners] =
    await Promise.all([
      generatePropertyOneLiners(inputs.properties, userId),
      generateAgentOneLiners(inputs.agents, userId),
      generateSuburbOneLiners(inputs.suburbs, userId),
    ]);

  return NextResponse.json({
    propertyOneLiners,
    agentOneLiners,
    suburbOneLiners,
  });
}
