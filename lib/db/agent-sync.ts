import { and, eq, sql } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { agents } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type Db = PostgresJsDatabase<typeof schema>;

export type AgentSyncInput = {
  agentName: string | null;
  agencyName: string | null;
  agentPhotoUrl: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
};

function normalizeKeyPart(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * If the property has any agent-related fields, find or create an `agents` row
 * for this user (match on normalized name + agency) and return its id.
 */
export async function resolveOrCreateAgentId(
  db: Db,
  userId: string,
  input: AgentSyncInput,
): Promise<string | null> {
  const nameTrim = (input.agentName ?? "").trim();
  const agencyTrim = (input.agencyName ?? "").trim();
  if (!nameTrim && !agencyTrim && !input.agentEmail?.trim() && !input.agentPhone?.trim()) {
    return null;
  }

  const matchName = normalizeKeyPart(nameTrim || agencyTrim || "unknown");
  const matchAgency = normalizeKeyPart(agencyTrim);

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(
        eq(agents.userId, userId),
        sql`lower(trim(${agents.name})) = ${matchName}`,
        sql`lower(trim(coalesce(${agents.agencyName}, ''))) = ${matchAgency}`,
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const displayName =
    nameTrim || agencyTrim || input.agentEmail?.split("@")[0]?.trim() || "Unknown agent";

  const [created] = await db
    .insert(agents)
    .values({
      userId,
      name: displayName,
      agencyName: agencyTrim || null,
      photoUrl: input.agentPhotoUrl?.trim() || null,
      email: input.agentEmail?.trim() || null,
      phone: input.agentPhone?.trim() || null,
    })
    .returning({ id: agents.id });

  return created?.id ?? null;
}
