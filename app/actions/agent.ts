"use server";

import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";
import { getHouseholdUserIds } from "@/lib/db/household";
import {
  agentConversations,
  agentInsights,
  users,
} from "@/lib/db/schema";
import { buildAgentContext } from "@/lib/agent/context";
import {
  buildAgentSystemPrompt,
  buildBriefingPrompt,
  buildPropertyInsightPrompt,
} from "@/lib/agent/system-prompt";
import type { ChatMessage } from "@/lib/agent/types";
import {
  DEFAULT_BRIEFING_TIMEZONE,
  getBriefingDayKeyInTimeZone,
} from "@/lib/agent/briefing";

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: key });
}

// ── Conversation helpers ─────────────────────────────────────────────

async function getOrCreateConversationForClerkUserId(clerkUserId: string) {
  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!u) return null;

  const [existing] = await db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.userId, u.id))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(agentConversations)
    .values({ userId: u.id, messages: [] })
    .returning();
  return created;
}

export async function getOrCreateConversation() {
  const user = await currentUser();
  if (!user) return null;
  return getOrCreateConversationForClerkUserId(user.id);
}

export async function sendMessage(
  conversationId: string,
  userMessage: string,
): Promise<{ reply: string; suggestedReplies: string[] }> {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");

  const db = getDb();
  const [convo] = await db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.id, conversationId))
    .limit(1);
  if (!convo) throw new Error("Conversation not found");

  const ctx = await buildAgentContext(user.id);
  const systemPrompt = buildAgentSystemPrompt(ctx);

  const history = (convo.messages ?? []) as ChatMessage[];
  history.push({
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  const truncatedHistory = history.slice(-40);

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: truncatedHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const assistantText =
    response.content[0].type === "text" ? response.content[0].text : "";

  history.push({
    role: "assistant",
    content: assistantText,
    timestamp: new Date().toISOString(),
  });

  await db
    .update(agentConversations)
    .set({ messages: history, updatedAt: new Date() })
    .where(eq(agentConversations.id, conversationId));

  const suggestedReplies = generateSuggestedReplies(ctx, assistantText);

  return { reply: assistantText, suggestedReplies };
}

// ── Daily briefing ───────────────────────────────────────────────────

async function appendBriefingToConversation(
  convoId: string,
  briefingText: string,
) {
  const db = getDb();
  const [convo] = await db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.id, convoId))
    .limit(1);
  if (!convo) return;

  const history = (convo.messages ?? []) as ChatMessage[];
  const trimmed = briefingText.trim();
  if (
    history.some(
      (m) =>
        m.role === "assistant" &&
        m.content.trim() === trimmed,
    )
  ) {
    return;
  }

  history.push({
    role: "assistant",
    content: trimmed,
    timestamp: new Date().toISOString(),
  });

  await db
    .update(agentConversations)
    .set({ messages: history, updatedAt: new Date() })
    .where(eq(agentConversations.id, convoId));
}

export async function generateDailyBriefing(
  clerkUserId: string,
  timeZone: string = DEFAULT_BRIEFING_TIMEZONE,
): Promise<{
  briefing: string;
  suggestedReplies: string[];
  conversationId: string;
} | null> {
  if (!clerkUserId) return null;

  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  if (!u) return null;

  const convo = await getOrCreateConversationForClerkUserId(clerkUserId);
  if (!convo) return null;

  const dayKey = getBriefingDayKeyInTimeZone(new Date(), timeZone);
  const titleKey = `brief:${dayKey}`;

  const [cached] = await db
    .select()
    .from(agentInsights)
    .where(
      and(
        eq(agentInsights.userId, u.id),
        eq(agentInsights.type, "briefing"),
        isNull(agentInsights.propertyId),
        eq(agentInsights.title, titleKey),
      ),
    )
    .orderBy(desc(agentInsights.createdAt))
    .limit(1);

  if (cached?.content?.trim()) {
    await appendBriefingToConversation(convo.id, cached.content);
    const ctx = await buildAgentContext(clerkUserId);
    return {
      briefing: cached.content.trim(),
      suggestedReplies: generateSuggestedReplies(ctx, cached.content),
      conversationId: convo.id,
    };
  }

  const ctx = await buildAgentContext(clerkUserId);
  const systemPrompt = buildAgentSystemPrompt(ctx);
  const briefingPrompt = buildBriefingPrompt(ctx);

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: briefingPrompt }],
  });

  const briefingText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const trimmed = briefingText.trim();
  if (!trimmed) {
    return {
      briefing: "",
      suggestedReplies: [],
      conversationId: convo.id,
    };
  }

  await db.insert(agentInsights).values({
    userId: u.id,
    propertyId: null,
    type: "briefing",
    title: titleKey,
    content: trimmed,
    priority: "normal",
    isRead: true,
  });

  await appendBriefingToConversation(convo.id, trimmed);

  return {
    briefing: trimmed,
    suggestedReplies: generateSuggestedReplies(ctx, trimmed),
    conversationId: convo.id,
  };
}

// ── Urgent actions (AI-generated) ────────────────────────────────────

export type UrgentActionItem = {
  id: string;
  title: string;
  reason: string;
  priority: "urgent" | "high" | "medium";
  suggestedMessage: string;
};

export async function generateUrgentActions(
  clerkUserId: string,
): Promise<UrgentActionItem[]> {
  if (!clerkUserId) return [];

  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return [];

    const cached = await db
      .select()
      .from(agentInsights)
      .where(
        and(
          eq(agentInsights.userId, u.id),
          eq(agentInsights.type, "urgent-actions"),
          gte(agentInsights.createdAt, new Date(Date.now() - 2 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(agentInsights.createdAt))
      .limit(1);

    if (cached.length > 0) {
      try {
        return JSON.parse(cached[0].content) as UrgentActionItem[];
      } catch {
        /* regenerate */
      }
    }

    const ctx = await buildAgentContext(clerkUserId);
    if (ctx.properties.length === 0) return [];

    const systemPrompt = buildAgentSystemPrompt(ctx);
    const prompt = `Based on this buyer's current property search, identify 3-5 genuinely urgent ACTIONS they need to take RIGHT NOW. Not reminders about upcoming events — real actions with deadlines and consequences.

Think about:
- Building/pest inspections that need booking before auction (inspectors need 3-5 days notice)
- Strata reports that need requesting (2-3 days to review)
- Finance/pre-approval deadlines
- Agent follow-ups that are overdue
- Comparisons that should be done before an inspection
- Contract reviews needed before auction

For each action, provide:
- title: Brief action statement (e.g. "Book building inspection for 6/800 Military Road")
- reason: Why this is urgent with specific timeframes (e.g. "Auction in 8 days. Building inspectors need 3-5 days notice.")
- priority: "urgent" (do today), "high" (do this week), or "medium" (soon)
- suggestedMessage: A question the buyer could ask you for help with this action

Return ONLY a JSON array. No other text. Example:
[{"title":"Book building inspection","reason":"Auction in 8 days","priority":"urgent","suggestedMessage":"Help me find building inspectors near Mosman"}]

If there are genuinely no urgent actions, return an empty array [].`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as UrgentActionItem[];
    const items = parsed.slice(0, 5).map((item, i) => ({
      ...item,
      id: `urgent-${Date.now()}-${i}`,
    }));

    await db.insert(agentInsights).values({
      userId: u.id,
      type: "urgent-actions",
      title: "Urgent Actions",
      content: JSON.stringify(items),
      priority: "high",
    });

    return items;
  } catch (e) {
    console.error("[agent] urgent actions generation failed:", e);
    return [];
  }
}

// ── Property one-liners (AI-generated, cached) ──────────────────────

export async function generatePropertyOneLiners(
  propertyList: { id: string; address: string; suburb: string; status: string; auctionDate: string | null }[],
  clerkUserId: string,
): Promise<Record<string, string>> {
  if (!clerkUserId || propertyList.length === 0) return {};

  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return {};
    const hhIds = await getHouseholdUserIds(u.id);

    const existing = await db
      .select()
      .from(agentInsights)
      .where(
        and(
          inArray(agentInsights.userId, hhIds),
          eq(agentInsights.type, "property-oneliner"),
          gte(agentInsights.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );

    const result: Record<string, string> = {};
    const cachedIds = new Set<string>();
    for (const row of existing) {
      if (row.propertyId && !result[row.propertyId]) {
        result[row.propertyId] = row.content;
        cachedIds.add(row.propertyId);
      }
    }

    const missing = propertyList.filter((p) => !cachedIds.has(p.id));
    if (missing.length === 0) return result;

    const ctx = await buildAgentContext(clerkUserId);
    const systemPrompt = buildAgentSystemPrompt(ctx);

    const propSummaries = missing
      .map((p) => `- ${p.id}: ${p.address}, ${p.suburb} (status: ${p.status}${p.auctionDate ? `, auction: ${p.auctionDate}` : ""})`)
      .join("\n");

    const prompt = `For each property below, write ONE punchy insight sentence (max 15 words). Be specific and actionable — reference auction timelines, comparable sales, inspection needs, market conditions. Not generic.

Properties:
${propSummaries}

Return ONLY a JSON object mapping property ID to one-liner string. Example:
{"uuid-1":"Auction in 8 days — book building inspection today","uuid-2":"Priced 15% above recent Mosman comparable sales"}`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    for (const [propId, oneLiner] of Object.entries(parsed)) {
      result[propId] = oneLiner;
      await db.insert(agentInsights).values({
        userId: u.id,
        propertyId: propId,
        type: "property-oneliner",
        title: "One-liner",
        content: oneLiner,
        priority: "normal",
      });
    }

    return result;
  } catch (e) {
    console.error("[agent] property one-liners failed:", e);
    return {};
  }
}

// ── Agent one-liners (AI-generated, cached) ─────────────────────────

export async function generateAgentOneLiners(
  agentList: { id: string; name: string; agencyName: string | null; propertyCount: number }[],
  clerkUserId: string,
): Promise<Record<string, string>> {
  if (!clerkUserId || agentList.length === 0) return {};

  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return {};

    const existing = await db
      .select()
      .from(agentInsights)
      .where(
        and(
          eq(agentInsights.userId, u.id),
          eq(agentInsights.type, "agent-oneliner"),
          gte(agentInsights.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );

    const result: Record<string, string> = {};
    const cachedIds = new Set<string>();
    for (const row of existing) {
      if (row.title.startsWith("agent:")) {
        const agentId = row.title.replace("agent:", "");
        result[agentId] = row.content;
        cachedIds.add(agentId);
      }
    }

    const missing = agentList.filter((a) => !cachedIds.has(a.id));
    if (missing.length === 0) return result;

    const agentSummaries = missing
      .map((a) => `- ${a.id}: ${a.name}${a.agencyName ? " (" + a.agencyName + ")" : ""}, ${a.propertyCount} linked properties`)
      .join("\n");

    const prompt = `For each real estate agent below, write ONE sentence (max 20 words) of practical advice for a buyer dealing with them. Be specific to the Australian property market. Reference negotiation style, auction tendencies, or market knowledge.

Agents:
${agentSummaries}

Return ONLY a JSON object mapping agent ID to one-liner. Example:
{"uuid-1":"Consistently sells above reserve in Mosman — don't rely on price guides, get comparable sales data"}`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: "You are an experienced Australian buyers agent advisor.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    for (const [agentId, oneLiner] of Object.entries(parsed)) {
      result[agentId] = oneLiner;
      await db.insert(agentInsights).values({
        userId: u.id,
        type: "agent-oneliner",
        title: `agent:${agentId}`,
        content: oneLiner,
        priority: "normal",
      });
    }

    return result;
  } catch (e) {
    console.error("[agent] agent one-liners failed:", e);
    return {};
  }
}

// ── Suburb one-liners (AI-generated, cached 24h) ────────────────────

export async function generateSuburbOneLiners(
  suburbList: { suburb: string; postcode: string }[],
  clerkUserId: string,
): Promise<Record<string, string>> {
  if (!clerkUserId || suburbList.length === 0) return {};

  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!u) return {};

    const existing = await db
      .select()
      .from(agentInsights)
      .where(
        and(
          eq(agentInsights.userId, u.id),
          eq(agentInsights.type, "suburb-oneliner"),
          gte(agentInsights.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );

    const result: Record<string, string> = {};
    const cachedKeys = new Set<string>();
    for (const row of existing) {
      const key = row.title.replace("suburb:", "");
      result[key] = row.content;
      cachedKeys.add(key);
    }

    const missing = suburbList.filter((s) => !cachedKeys.has(`${s.suburb}-${s.postcode}`));
    if (missing.length === 0) return result;

    const subSummaries = missing
      .map((s) => `- ${s.suburb} ${s.postcode}`)
      .join("\n");

    const prompt = `For each Australian suburb below, write ONE concise market summary sentence (max 20 words). Reference median prices, recent trends, auction clearance rates, or buyer competition level where applicable.

Suburbs:
${subSummaries}

Return ONLY a JSON object mapping "Suburb-Postcode" to one-liner. Example:
{"Mosman-2088":"Median $3.2M, up 6% this year. Competitive auction market with 78% clearance."}`;

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: "You are an experienced Australian property market analyst.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    for (const [key, oneLiner] of Object.entries(parsed)) {
      result[key] = oneLiner;
      await db.insert(agentInsights).values({
        userId: u.id,
        type: "suburb-oneliner",
        title: `suburb:${key}`,
        content: oneLiner,
        priority: "normal",
      });
    }

    return result;
  } catch (e) {
    console.error("[agent] suburb one-liners failed:", e);
    return {};
  }
}

// ── Property insights ────────────────────────────────────────────────

export async function generatePropertyInsights(
  propertyId: string,
): Promise<{ title: string; content: string }[]> {
  const user = await currentUser();
  if (!user) return [];

  try {
    const ctx = await buildAgentContext(user.id);
    const systemPrompt = buildAgentSystemPrompt(ctx);
    const insightPrompt = buildPropertyInsightPrompt(ctx, propertyId);

    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: insightPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      content: string;
    }[];

    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (u) {
      for (const insight of parsed) {
        await db.insert(agentInsights).values({
          userId: u.id,
          propertyId,
          type: "insight",
          title: insight.title,
          content: insight.content,
          priority: "normal",
        });
      }
    }

    return parsed;
  } catch (e) {
    console.error("[agent] insight generation failed:", e);
    return [];
  }
}

// ── Insights CRUD ────────────────────────────────────────────────────

export async function getInsights() {
  const user = await currentUser();
  if (!user) return [];
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);
    if (!u) return [];
    const hhIds = await getHouseholdUserIds(u.id);
    return db
      .select()
      .from(agentInsights)
      .where(
        and(
          inArray(agentInsights.userId, hhIds),
          eq(agentInsights.isRead, false),
          ne(agentInsights.type, "briefing"),
        ),
      )
      .orderBy(desc(agentInsights.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

export async function markInsightRead(insightId: string) {
  const user = await currentUser();
  if (!user) return;
  try {
    const db = getDb();
    await db
      .update(agentInsights)
      .set({ isRead: true })
      .where(eq(agentInsights.id, insightId));
  } catch {
    // ignore
  }
}

export async function getPropertyInsightsCached(propertyId: string) {
  const user = await currentUser();
  if (!user) return [];
  try {
    const db = getDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);
    if (!u) return [];
    const hhIds = await getHouseholdUserIds(u.id);
    return db
      .select()
      .from(agentInsights)
      .where(
        and(
          inArray(agentInsights.userId, hhIds),
          eq(agentInsights.propertyId, propertyId),
        ),
      )
      .orderBy(desc(agentInsights.createdAt))
      .limit(5);
  } catch {
    return [];
  }
}

// ── Suggested replies ────────────────────────────────────────────────

function generateSuggestedReplies(
  ctx: { properties: { address: string }[]; upcomingInspections: { address: string }[] },
  lastAssistantMessage: string,
): string[] {
  const suggestions: string[] = [];

  if (lastAssistantMessage.toLowerCase().includes("auction")) {
    suggestions.push("What's a good bidding strategy?");
  }
  if (lastAssistantMessage.toLowerCase().includes("inspection")) {
    suggestions.push("What should I check at the inspection?");
  }
  if (ctx.properties.length > 1) {
    suggestions.push("Compare my top properties");
  }
  if (ctx.upcomingInspections.length > 0) {
    suggestions.push("Plan my Saturday inspections");
  }

  const defaults = [
    "What should I do next?",
    "Draft an email to the agent",
    "Tell me about the suburb market",
    "What are the risks with this property?",
    "Help me with my finance checklist",
  ];

  for (const d of defaults) {
    if (suggestions.length >= 3) break;
    if (!suggestions.includes(d)) suggestions.push(d);
  }

  return suggestions.slice(0, 3);
}
