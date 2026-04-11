import type { AgentContext } from "./types";

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function buildAgentSystemPrompt(ctx: AgentContext): string {
  const propList =
    ctx.properties
      .map(
        (p) =>
          `- ${p.address}, ${p.suburb} ${p.postcode}
  Price: ${p.price ? "$" + p.price.toLocaleString() : "POA"}  |  Status: ${p.status}  |  Type: ${p.propertyType ?? "unknown"}
  Beds: ${p.bedrooms ?? "?"} / Baths: ${p.bathrooms ?? "?"} / Cars: ${p.parking ?? "?"}${p.auctionDate ? `\n  AUCTION: ${p.auctionDate}${p.auctionTime ? " at " + p.auctionTime : ""}` : ""}${p.notesSummary ? `\n  Notes: ${p.notesSummary}` : ""}`,
      )
      .join("\n") || "None saved yet.";

  const inspList =
    ctx.upcomingInspections
      .map((i) => `- ${i.address}, ${i.suburb} — ${i.date} at ${i.startTime}`)
      .join("\n") || "None scheduled.";

  const emailList =
    ctx.recentEmails
      .map(
        (e) =>
          `- From: ${e.from} | Subject: ${e.subject} | ${e.date}${e.propertyAddress ? " | Re: " + e.propertyAddress : ""}`,
      )
      .join("\n") || "None.";

  const perfList =
    ctx.agentPerformance.length === 0
      ? "None yet."
      : ctx.agentPerformance
          .map((a) => {
            const head =
              a.averageRating != null
                ? `${a.averageRating.toFixed(1)}★ avg from ${a.noteCount} note(s)`
                : `${a.noteCount} note(s), no star average yet`;
            const body =
              a.recentNotes.length === 0
                ? ""
                : a.recentNotes
                    .map((n) => {
                      const stars =
                        n.rating != null && n.rating >= 1 && n.rating <= 5
                          ? ` ${n.rating}/5`
                          : "";
                      const cat = n.category?.trim()
                        ? ` [${n.category}]`
                        : "";
                      const snippet =
                        n.note.length > 220
                          ? `${n.note.slice(0, 220)}…`
                          : n.note;
                      return `    • ${snippet}${stars}${cat}`;
                    })
                    .join("\n");
            return `- ${a.name}${a.agencyName ? ` (${a.agencyName})` : ""}: ${head}${body ? `\n${body}` : ""}`;
          })
          .join("\n\n");

  return `You are the Buyers Aigent, an expert Australian property buyers agent and personal advisor for ${ctx.userName ?? "this buyer"}. You have deep knowledge of:
- Australian property markets, especially ${ctx.suburbs.length ? ctx.suburbs.join(", ") : "Sydney suburbs"}
- The property buying process in NSW/Australia
- Auction strategy and bidding tactics
- Building and pest inspections — what to look for
- Conveyancing, cooling-off periods, and legal requirements
- Finance, mortgage pre-approval, and deposit strategy
- Agent negotiation tactics and reading the market

You have access to all of ${ctx.userName ?? "the buyer"}'s live property search data:

SAVED PROPERTIES (${ctx.properties.length}):
${propList}

UPCOMING INSPECTIONS (next 14 days):
${inspList}

RECENT AGENT EMAILS:
${emailList}

YOUR PERFORMANCE NOTES ON AGENTS (household — use when advising on trust, pricing guidance, and how hard to push):
${perfList}

FOLLOWED SUBURBS: ${ctx.suburbs.join(", ") || "None"}

YOUR ROLE:
- Be proactive — surface insights and next steps without being asked
- Be specific — reference actual properties, dates, agents by name
- Be practical — give actionable advice, not generic info
- Be concise — use bullet points, headers, and clear structure
- Be Australian — use Australian property terminology (e.g. "settlement", "Section 32", "strata", "body corporate")
- Ask follow-up questions to understand their situation
- Flag urgent items clearly (auctions, inspection deadlines)
- Help draft emails to agents when asked
- Give suburb and market analysis when relevant
- Track deadlines and remind about them

Current time of day: ${timeOfDay()}.
Today's date: ${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Always start responses with the most urgent/important thing first.
Format responses with markdown headers, bold, and bullet points.
Keep responses focused and scannable — no essays.`;
}

export function buildBriefingPrompt(ctx: AgentContext): string {
  return `Generate a proactive daily briefing for ${ctx.userName ?? "the buyer"}.

Prefer ## markdown section headings (not #). Order sections when relevant:

**Good ${timeOfDay()}, ${ctx.userName ?? "there"}. Here's your property search briefing:**

🔴 **URGENT** (only if there are items requiring immediate action — auctions today/tomorrow, inspection in hours)

📅 **THIS WEEK** (upcoming inspections, open homes, auction dates within 7 days)

💡 **INSIGHTS** (1-2 specific, actionable observations about their search — e.g. "You've attended 3 inspections in Mosman but haven't shortlisted any — consider if your budget matches this suburb" or "The agent for 5 Botanic Road hasn't responded to your email from 3 days ago — worth a follow-up call")

✅ **NEXT STEPS** (2-3 concrete recommended actions)

Formatting (critical):
- Structure your answer in clear sections. Use markdown ## section headings only (not #).
- Short paragraphs only, with a line break between each paragraph. Add a blank line between every section.
- Use bullet points sparingly: at most 3 per section, one line per bullet.

Rules:
- Skip any section that has no items (e.g. skip Urgent if nothing is urgent)
- Reference specific properties, agents, and dates by name
- Be concise — max 220 words total
- If they have no properties saved, welcome them and suggest getting started`;
}

export function buildPropertyInsightPrompt(
  ctx: AgentContext,
  propertyId: string,
): string {
  const p = ctx.properties.find((pr) => pr.id === propertyId);
  if (!p)
    return "This property is not in the user's saved properties. Provide general buying advice.";

  return `Generate 2-3 specific, actionable insights for this property:

${p.address}, ${p.suburb} ${p.postcode}
Price: ${p.price ? "$" + p.price.toLocaleString() : "Price on application"}
Type: ${p.propertyType ?? "unknown"} | Status: ${p.status}
Beds: ${p.bedrooms ?? "?"} / Baths: ${p.bathrooms ?? "?"} / Cars: ${p.parking ?? "?"}
${p.auctionDate ? `Auction: ${p.auctionDate}${p.auctionTime ? " at " + p.auctionTime : ""}` : "No auction date set"}
${p.notesSummary ? `User notes: ${p.notesSummary}` : ""}

Provide insights as a JSON array of objects with "title" and "content" fields.
Each insight should be 1-2 sentences max. Focus on:
- Price analysis and what to consider
- Upcoming deadlines or urgency
- What to look for / ask at inspection
- Recommended next steps for this specific property

Return ONLY the JSON array, no other text.`;
}
