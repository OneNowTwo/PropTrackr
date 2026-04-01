import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";

import { AgentChecklistSection } from "@/components/agents/agent-checklist-section";
import { EditAgentDialog } from "@/components/agents/edit-agent-dialog";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAgentDetailForClerkSafe } from "@/lib/db/agent-queries";
import { isValidPropertyId } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

type Props = { params: { id: string } };

export default async function AgentDetailPage({ params }: Props) {
  const { id } = params;
  if (!id || !isValidPropertyId(id)) notFound();

  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const bundle = await getAgentDetailForClerkSafe(id, user?.id);
  if (!bundle) notFound();

  const { agent, linkedProperties, checklist, propertyOptions } = bundle;
  const initial = agent.name.trim()
    ? agent.name.trim().charAt(0).toUpperCase()
    : agent.agencyName?.trim()
      ? agent.agencyName.trim().charAt(0).toUpperCase()
      : "?";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 w-fit gap-1 text-foreground hover:bg-muted"
          asChild
        >
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
            Back to agents
          </Link>
        </Button>

        <div className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-start gap-4">
            {agent.photoUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.photoUrl.trim()}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-lg font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]"
                aria-hidden
              >
                {initial}
              </div>
            )}
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
                {agent.name}
              </h1>
              {agent.agencyName?.trim() ? (
                <p className="text-[#6B7280]">{agent.agencyName}</p>
              ) : null}
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
                {agent.phone?.trim() ? (
                  <a
                    href={`tel:${agent.phone.trim().replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2 font-medium text-[#0D9488] hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                    {agent.phone.trim()}
                  </a>
                ) : null}
                {agent.email?.trim() ? (
                  <a
                    href={`mailto:${agent.email.trim()}`}
                    className="inline-flex min-w-0 items-center gap-2 break-all font-medium text-[#0D9488] hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    {agent.email.trim()}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <EditAgentDialog agent={agent} />
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
          Properties
        </h2>
        {linkedProperties.length === 0 ? (
          <Card className="border-dashed border-[#E5E7EB] bg-white shadow-sm">
            <CardContent className="py-8 text-center text-sm text-[#6B7280]">
              No saved listings are linked to this agent yet. Add agent details when
              you save a property to link them automatically.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {linkedProperties.map((property) => (
              <li key={property.id}>
                <PropertyCard property={property} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AgentChecklistSection
        agentId={agent.id}
        checklist={checklist}
        propertyOptions={propertyOptions}
      />

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#111827]">Track record</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            Track record coming soon — will show sold history, average days on market,
            and sale vs asking price ratio.
          </p>
        </CardContent>
      </Card>

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#111827]">Correspondence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            Connect Gmail to see email correspondence with this agent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
