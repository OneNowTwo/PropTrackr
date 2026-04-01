import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Building2, Mail, Phone, Users } from "lucide-react";

import { AddAgentDialog } from "@/components/agents/add-agent-dialog";
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
          {agents.map((a) => {
            const initial = a.name.trim()
              ? a.name.trim().charAt(0).toUpperCase()
              : a.agencyName?.trim()
                ? a.agencyName.trim().charAt(0).toUpperCase()
                : "?";
            return (
              <li key={a.id}>
                <Link
                  href={`/agents/${a.id}`}
                  className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F9FA]"
                >
                  <Card className="h-full overflow-hidden border-[#E5E7EB] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        {a.photoUrl?.trim() ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photoUrl.trim()}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-sm font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                            aria-hidden
                          >
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-semibold leading-snug text-[#111827] group-hover:text-[#0D9488]">
                            {a.name}
                          </p>
                          {a.agencyName?.trim() ? (
                            <p className="text-sm text-[#6B7280]">{a.agencyName}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-4 text-sm">
                        {a.phone?.trim() ? (
                          <p className="flex items-center gap-2 text-[#6B7280]">
                            <Phone className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                            <span className="truncate text-[#111827]">{a.phone.trim()}</span>
                          </p>
                        ) : null}
                        {a.email?.trim() ? (
                          <p className="flex items-center gap-2 text-[#6B7280]">
                            <Mail className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                            <span className="truncate text-[#111827]">{a.email.trim()}</span>
                          </p>
                        ) : null}
                        <p className="flex items-center gap-2 pt-1 text-[#6B7280]">
                          <Building2 className="h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                          <span>
                            <span className="font-medium tabular-nums text-[#111827]">
                              {a.propertyCount}
                            </span>{" "}
                            {a.propertyCount === 1 ? "property" : "properties"} saved
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
