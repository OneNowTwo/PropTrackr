import { currentUser } from "@clerk/nextjs/server";
import { Users } from "lucide-react";

import { AddAgentDialog } from "@/components/agents/add-agent-dialog";
import { AgentListCard } from "@/components/agents/agent-list-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgentsWithPropertyCountsForClerkSafe } from "@/lib/db/agent-queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

export default async function AgentsPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const agents = await getAgentsWithPropertyCountsForClerkSafe(user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Agents
          </h1>
          <p className="mt-1 text-[#6B7280]">
            Everyone you are working with on your property search.
          </p>
        </div>
        <AddAgentDialog />
      </div>

      {agents.length === 0 ? (
        <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium text-[#111827]">
              <Users className="h-5 w-5 text-[#0D9488]" />
              No agents yet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#6B7280]">
            <p>
              Agents appear when you save listing details that include an agent,
              or you can add one manually.
            </p>
            <AddAgentDialog />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <li key={a.id}>
              <AgentListCard agent={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
