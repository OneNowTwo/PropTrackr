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
      .map(
        (i) =>
          `- ${i.address}, ${i.suburb} — ${i.date} at ${i.startTime}${i.propertyId ? ` (property ${i.propertyId})` : ""}`,
      )
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
  return `Write a morning briefing for ${ctx.userName ?? "the buyer"} using ONLY their saved context (properties, inspections, emails, suburbs).

Write a morning briefing that is:
- Maximum 150 words total
- 3 sections maximum: URGENT, THIS WEEK, ONE INSIGHT
- Each section has maximum 2-3 bullet points
- Each bullet point is ONE line only - no sub-points
- Use plain language, no jargon
- Start with the most urgent thing
- End with one actionable insight
- Do NOT use markdown headers with # symbols
- Use UPPERCASE for section labels (URGENT:, THIS WEEK:, INSIGHT:)
- No greeting, no sign-off, just the briefing

Formatting:
- After each section label, use a blank line, then bullet lines starting with "- "
- You may use **bold** sparingly for critical phrases only
- Skip a section entirely if there is nothing relevant (do not write "none" or filler)
- Reference real addresses, suburbs, agents, and dates from the context when relevant
- If they have no properties saved, one short block: suggest saving a first listing and connecting Gmail (under 40 words total)`;
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
