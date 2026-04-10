"use server";

import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, inArray } from "drizzle-orm";
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

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: key });
}

// ── Conversation helpers ─────────────────────────────────────────────

export async function getOrCreateConversation() {
  const user = await currentUser();
  if (!user) return null;

  const db = getDb();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, user.id))
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

export async function generateDailyBriefing(): Promise<{
  briefing: string;
  suggestedReplies: string[];
  conversationId: string;
} | null> {
  const user = await currentUser();
  if (!user) return null;

  const convo = await getOrCreateConversation();
  if (!convo) return null;

  const history = (convo.messages ?? []) as ChatMessage[];

  const today = new Date().toISOString().slice(0, 10);
  const hasBriefingToday = history.some(
    (m) =>
      m.role === "assistant" &&
      m.timestamp?.startsWith(today) &&
      m.content.includes("briefing"),
  );
  if (hasBriefingToday && history.length > 0) {
    return {
      briefing: "",
      suggestedReplies: [],
      conversationId: convo.id,
    };
  }

  const ctx = await buildAgentContext(user.id);
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

  const db = getDb();

  history.push({
    role: "assistant",
    content: briefingText,
    timestamp: new Date().toISOString(),
  });

  await db
    .update(agentConversations)
    .set({ messages: history, updatedAt: new Date() })
    .where(eq(agentConversations.id, convo.id));

  return {
    briefing: briefingText,
    suggestedReplies: generateSuggestedReplies(ctx, briefingText),
    conversationId: convo.id,
  };
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
