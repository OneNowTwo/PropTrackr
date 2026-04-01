export type AgentFields = {
  agentId?: string | null;
  agentName: string | null;
  agencyName: string | null;
  agentPhotoUrl: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
};

export function hasAnyAgentField(p: AgentFields): boolean {
  return Boolean(
    p.agentId ||
      p.agentName?.trim() ||
      p.agencyName?.trim() ||
      p.agentPhotoUrl?.trim() ||
      p.agentEmail?.trim() ||
      p.agentPhone?.trim(),
  );
}
