import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";

import { AskAigentButton } from "@/components/agent/ask-aigent-button";
import { DeleteAgentButton } from "@/components/agents/delete-agent-button";
import { AgentEmailsSection } from "@/components/agents/agent-emails-section";
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
import { getPropertyEmailsForAgentSafe } from "@/lib/db/gmail-queries";
import { getAgentDetailForClerkSafe } from "@/lib/db/agent-queries";
import { isValidPropertyId } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";

type Props = { params: { id: string } };

export default async function AgentDetailPage({ params }: Props) {
  const { id } = params;
  if (!id || !isValidPropertyId(id)) notFound();

  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const [bundle, agentEmails] = await Promise.all([
    getAgentDetailForClerkSafe(id, user?.id),
    getPropertyEmailsForAgentSafe(id, user?.id),
  ]);
  if (!bundle) notFound();

  const {
    agent,
    linkedProperties,
    checklist,
    propertyOptions,
    inspectionsAttendedWithAgent,
  } = bundle;
  const agentEmailsClient = JSON.parse(JSON.stringify(agentEmails));
  const googleQuery = encodeURIComponent(
    `${agent.name.trim()} realestate.com.au`,
  );
  const trackRecordHref = `https://www.google.com/search?q=${googleQuery}`;
  const agentReviewsQuery = encodeURIComponent(
    `${agent.name.trim()} ${agent.agencyName?.trim() ?? ""} real estate reviews`
      .replace(/\s+/g, " ")
      .trim(),
  );
  const searchAgentGoogleHref = `https://www.google.com/search?q=${agentReviewsQuery}`;
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
                <a
                  href={searchAgentGoogleHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 font-semibold text-[#0D9488] hover:underline"
                >
                  Search agent on Google →
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                </a>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <DeleteAgentButton
              agentId={agent.id}
              variant="compact"
              className="border border-[#E5E7EB] bg-white shadow-sm hover:bg-red-50"
            />
            <EditAgentDialog agent={agent} />
          </div>
        </div>
      </div>

      <AskAigentButton
        message={`Tell me about ${agent.name}${agent.agencyName ? " from " + agent.agencyName : ""}. What should I know when dealing with them?`}
        label={`Ask Buyers Aigent about ${agent.name} →`}
      />

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
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Properties with this agent
              </dt>
              <dd className="mt-2 text-3xl font-bold tabular-nums text-[#0D9488]">
                {linkedProperties.length}
              </dd>
              <dd className="mt-1 text-xs text-[#6B7280]">
                Saved in PropTrackr and linked to this contact.
              </dd>
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Inspections you attended
              </dt>
              <dd className="mt-2 text-3xl font-bold tabular-nums text-[#0D9488]">
                {inspectionsAttendedWithAgent}
              </dd>
              <dd className="mt-1 text-xs text-[#6B7280]">
                On listings linked to this agent (marked attended in your planner).
              </dd>
            </div>
          </dl>
          <a
            href={trackRecordHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-semibold text-[#0D9488] hover:underline"
          >
            Full track record via realestate.com.au →
          </a>
        </CardContent>
      </Card>

      <AgentEmailsSection emails={agentEmailsClient} />
    </div>
  );
}
