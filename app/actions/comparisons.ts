"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, desc, eq, or } from "drizzle-orm";

import { getAnthropic } from "@/lib/anthropic";
import { getDb } from "@/lib/db";
import { comparisons, properties } from "@/lib/db/schema";
import { isValidPropertyId } from "@/lib/db/queries";
import { getOrCreateUserByClerkId } from "@/lib/db/users";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export type ComparisonRowResult = {
  id: string;
  aiSummary: string;
  createdAt: string;
};

export type GetComparisonResult =
  | { ok: true; comparison: ComparisonRowResult | null }
  | { ok: false; error: string };

export type CreateComparisonResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; error: string };

export type GenerateVerdictResult =
  | { ok: true; verdict: string; createdAt: string; comparisonId: string }
  | { ok: false; error: string };

async function requireDbUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  const dbUser = await getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
  return dbUser;
}

async function assertUserOwnsBothProperties(
  dbUserId: string,
  propertyAId: string,
  propertyBId: string,
): Promise<boolean> {
  const db = getDb();
  const [a, b] = await Promise.all([
    db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(eq(properties.id, propertyAId), eq(properties.userId, dbUserId)),
      )
      .limit(1),
    db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(eq(properties.id, propertyBId), eq(properties.userId, dbUserId)),
      )
      .limit(1),
  ]);
  return Boolean(a[0] && b[0]);
}

export async function getComparison(
  propertyAId: string,
  propertyBId: string,
): Promise<GetComparisonResult> {
  if (!isValidPropertyId(propertyAId) || !isValidPropertyId(propertyBId)) {
    return { ok: false, error: "Invalid property id." };
  }
  if (propertyAId === propertyBId) {
    return { ok: true, comparison: null };
  }

  const dbUser = await requireDbUser();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const owns = await assertUserOwnsBothProperties(
    dbUser.id,
    propertyAId,
    propertyBId,
  );
  if (!owns) {
    return { ok: false, error: "One or both properties were not found." };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: comparisons.id,
        aiSummary: comparisons.aiSummary,
        createdAt: comparisons.createdAt,
      })
      .from(comparisons)
      .where(
        and(
          eq(comparisons.userId, dbUser.id),
          or(
            and(
              eq(comparisons.propertyAId, propertyAId),
              eq(comparisons.propertyBId, propertyBId),
            ),
            and(
              eq(comparisons.propertyAId, propertyBId),
              eq(comparisons.propertyBId, propertyAId),
            ),
          ),
        ),
      )
      .orderBy(desc(comparisons.createdAt))
      .limit(1);

    const row = rows[0];
    if (!row?.aiSummary?.trim()) {
      return { ok: true, comparison: null };
    }

    return {
      ok: true,
      comparison: {
        id: row.id,
        aiSummary: row.aiSummary.trim(),
        createdAt: row.createdAt.toISOString(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load comparison.";
    return { ok: false, error: msg };
  }
}

export async function createComparison(
  propertyAId: string,
  propertyBId: string,
  aiSummary: string,
): Promise<CreateComparisonResult> {
  if (!isValidPropertyId(propertyAId) || !isValidPropertyId(propertyBId)) {
    return { ok: false, error: "Invalid property id." };
  }
  const summary = aiSummary.trim();
  if (!summary) {
    return { ok: false, error: "Summary cannot be empty." };
  }

  const dbUser = await requireDbUser();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const owns = await assertUserOwnsBothProperties(
    dbUser.id,
    propertyAId,
    propertyBId,
  );
  if (!owns) {
    return { ok: false, error: "One or both properties were not found." };
  }

  try {
    const db = getDb();
    const [inserted] = await db
      .insert(comparisons)
      .values({
        userId: dbUser.id,
        propertyAId,
        propertyBId,
        aiSummary: summary,
      })
      .returning({
        id: comparisons.id,
        createdAt: comparisons.createdAt,
      });

    if (!inserted) {
      return { ok: false, error: "Could not save comparison." };
    }

    revalidatePath("/compare");

    return {
      ok: true,
      id: inserted.id,
      createdAt: inserted.createdAt.toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save comparison.";
    return { ok: false, error: msg };
  }
}

function propertyPayloadForAi(p: typeof properties.$inferSelect) {
  return {
    title: p.title,
    address: p.address,
    suburb: p.suburb,
    state: p.state,
    postcode: p.postcode,
    price: p.price,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    propertyType: p.propertyType,
    status: p.status,
    notes: p.notes,
    listingUrl: p.listingUrl,
    agentName: p.agentName,
    agencyName: p.agencyName,
    landSize: p.landSize,
  };
}

export async function generateComparisonVerdict(
  propertyAId: string,
  propertyBId: string,
): Promise<GenerateVerdictResult> {
  if (!isValidPropertyId(propertyAId) || !isValidPropertyId(propertyBId)) {
    return { ok: false, error: "Invalid property id." };
  }
  if (propertyAId === propertyBId) {
    return { ok: false, error: "Choose two different properties." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Anthropic is not configured." };
  }

  const dbUser = await requireDbUser();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const [rowsA, rowsB] = await Promise.all([
    db
      .select()
      .from(properties)
      .where(
        and(eq(properties.id, propertyAId), eq(properties.userId, dbUser.id)),
      )
      .limit(1),
    db
      .select()
      .from(properties)
      .where(
        and(eq(properties.id, propertyBId), eq(properties.userId, dbUser.id)),
      )
      .limit(1),
  ]);

  const propA = rowsA[0];
  const propB = rowsB[0];
  if (!propA || !propB) {
    return { ok: false, error: "One or both properties were not found." };
  }

  const advisorPrompt = `You are a property buying advisor. Compare these two properties and give a clear, honest verdict. Cover: value for money, lifestyle fit, investment potential, and any red flags. End with a clear recommendation of which property to prioritise and why. Be direct and specific, not generic.

Property A (left column in the app):
${JSON.stringify(propertyPayloadForAi(propA), null, 2)}

Property B (right column in the app):
${JSON.stringify(propertyPayloadForAi(propB), null, 2)}

Write in plain paragraphs. Do not use markdown headings or bullet lists unless essential.`;

  let verdict: string;
  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.35,
      messages: [{ role: "user", content: advisorPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    verdict =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    if (!verdict) {
      return { ok: false, error: "AI returned an empty verdict." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed.";
    return { ok: false, error: msg };
  }

  const save = await createComparison(propertyAId, propertyBId, verdict);
  if (!save.ok) {
    return { ok: false, error: save.error };
  }

  return {
    ok: true,
    verdict,
    createdAt: save.createdAt,
    comparisonId: save.id,
  };
}
