"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getAnthropic } from "@/lib/anthropic";
import { getDb } from "@/lib/db";
import { properties, voiceNotes } from "@/lib/db/schema";
import { getOrCreateUserByClerkId } from "@/lib/db/users";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
/** Inline data URLs larger than this are not stored (Postgres / action size). */
const MAX_INLINE_AUDIO_CHARS = 450_000;

const VOICE_SYSTEM = `Transcribe this property inspection voice note and extract:
1. Full transcript
2. Pros (positives noticed)
3. Cons (negatives or concerns)
4. Questions to ask the agent

Return as JSON: { "transcript": string, "pros": string[], "cons": string[], "questions": string[] }

Return ONLY valid JSON (no markdown fences). Use empty arrays when a category has nothing.`;

export type VoiceNoteActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireUserRow() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  if (!process.env.DATABASE_URL) return null;
  return getOrCreateUserByClerkId({
    clerkId: userId,
    email,
    name: clerkUser?.fullName ?? null,
  });
}

type VoiceJson = {
  transcript?: string;
  pros?: string[];
  cons?: string[];
  questions?: string[];
};

function parseVoiceJson(raw: string): VoiceJson | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  try {
    const v = JSON.parse(s) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as VoiceJson;
    }
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const v = JSON.parse(s.slice(start, end + 1)) as unknown;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          return v as VoiceJson;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

export async function createVoiceNote(formData: FormData): Promise<VoiceNoteActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Anthropic is not configured." };
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const transcriptDraft = String(formData.get("transcriptDraft") ?? "").trim();
  const audioBase64 = String(formData.get("audioBase64") ?? "").trim();
  const mimeType = String(formData.get("mimeType") ?? "audio/webm").trim();

  if (!propertyId) {
    return { ok: false, error: "Missing property." };
  }

  if (!transcriptDraft) {
    return {
      ok: false,
      error:
        "No speech captured. Allow microphone, use Chrome, and speak clearly while recording.",
    };
  }

  const db = getDb();
  const [prop] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(eq(properties.id, propertyId), eq(properties.userId, dbUser.id)),
    )
    .limit(1);
  if (!prop) {
    return { ok: false, error: "Property not found." };
  }

  let parsed: VoiceJson;
  try {
    const anthropic = getAnthropic();
    const userMessage = `The text below is a raw browser speech-to-text capture of a property inspection recording (may contain errors). Polish it into a full transcript and extract pros, cons, and questions per the system instructions.

Raw speech-to-text:
${transcriptDraft}

(Audio was also recorded as ${mimeType} for the user's records; use the text above as the source.)`;

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      system: VOICE_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const extracted = raw ? parseVoiceJson(raw) : null;
    if (!extracted) {
      return { ok: false, error: "Could not parse AI response. Try again." };
    }
    parsed = extracted;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed.";
    return { ok: false, error: msg };
  }

  const transcript = (parsed.transcript ?? transcriptDraft).trim();
  const pros = asStringArray(parsed.pros);
  const cons = asStringArray(parsed.cons);
  const questions = asStringArray(parsed.questions);

  const summary =
    transcript.length > 280 ? `${transcript.slice(0, 277).trim()}…` : transcript;

  let audioUrl = "recording";
  if (audioBase64 && mimeType) {
    const dataUrl = `data:${mimeType};base64,${audioBase64}`;
    if (dataUrl.length <= MAX_INLINE_AUDIO_CHARS) {
      audioUrl = dataUrl;
    }
  }

  try {
    await db.insert(voiceNotes).values({
      propertyId,
      userId: dbUser.id,
      audioUrl,
      transcript,
      aiSummary: summary || null,
      pros: pros.length ? pros : null,
      cons: cons.length ? cons : null,
      questions: questions.length ? questions : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save voice note.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteVoiceNote(voiceNoteId: string): Promise<VoiceNoteActionResult> {
  const dbUser = await requireUserRow();
  if (!dbUser) {
    return { ok: false, error: "You must be signed in." };
  }

  const db = getDb();
  const rows = await db
    .select({ id: voiceNotes.id, propertyId: voiceNotes.propertyId })
    .from(voiceNotes)
    .innerJoin(properties, eq(voiceNotes.propertyId, properties.id))
    .where(
      and(eq(voiceNotes.id, voiceNoteId), eq(properties.userId, dbUser.id)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Voice note not found." };
  }

  try {
    await db.delete(voiceNotes).where(eq(voiceNotes.id, voiceNoteId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/properties/${row.propertyId}`);
  return { ok: true };
}
