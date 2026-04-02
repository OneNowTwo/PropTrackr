import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { eq } from "drizzle-orm";

import { PropertyEmailsSection } from "@/components/properties/property-emails-section";
import { PropertyShareButton } from "@/components/properties/property-share-button";
import { PropertyStatusSelect } from "@/components/properties/property-status-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PropertyAgentSection } from "@/components/properties/property-agent-section";
import { PropertyImageGallery } from "@/components/properties/property-image-gallery";
import { PropertyAuctionBanner } from "@/components/properties/property-auction-banner";
import { hasAnyAgentField } from "@/lib/property-agent";
import { PropertyDocumentsSection } from "@/components/properties/property-documents-section";
import { PropertyInspectionsSection } from "@/components/properties/property-inspections-section";
import { PropertyNotesSection } from "@/components/properties/property-notes-section";
import { PropertyVoiceNotesSection } from "@/components/properties/property-voice-notes-section";
import { getDb } from "@/lib/db";
import {
  getGmailDocumentsForPropertyAndMessages,
  getPropertyEmailsForPropertySafe,
} from "@/lib/db/gmail-queries";
import {
  getDocumentsForPropertySafe,
  getInspectionsForPropertySafe,
  getPropertyForClerkUserSafe,
  getPropertyNotesForPropertySafe,
  getVoiceNotesForPropertySafe,
  isValidPropertyId,
} from "@/lib/db/queries";
import { users } from "@/lib/db/schema";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { formatAud } from "@/lib/utils";
import { currentUser } from "@clerk/nextjs/server";

type Props = { params: { id: string } };

function locationLine(p: {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}) {
  const tail = [p.state, p.postcode].filter(Boolean).join(" ");
  return [p.address, [p.suburb, tail].filter(Boolean).join(" ")].join(", ");
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = params;
  if (!id || !isValidPropertyId(id)) notFound();

  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const property = await getPropertyForClerkUserSafe(id, user?.id);
  if (!property) notFound();

  const [inspectionsPack, notesList, docsList, voiceList, emailRows] =
    await Promise.all([
      getInspectionsForPropertySafe(id),
      getPropertyNotesForPropertySafe(id),
      getDocumentsForPropertySafe(id),
      getVoiceNotesForPropertySafe(id),
      getPropertyEmailsForPropertySafe(id, user?.id),
    ]);

  const attachmentsByMessageId: Record<
    string,
    {
      id: string;
      fileUrl: string;
      fileName: string;
      fileType: string | null;
      gmailMessageId: string | null;
    }[]
  > = {};

  if (emailRows.length && user?.id && process.env.DATABASE_URL) {
    const db = getDb();
    const [ur] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);
    if (ur) {
      const mids = emailRows.map((e) => e.gmailMessageId);
      const gdocs = await getGmailDocumentsForPropertyAndMessages(
        ur.id,
        id,
        mids,
      );
      for (const d of gdocs) {
        if (!d.gmailMessageId) continue;
        const list = attachmentsByMessageId[d.gmailMessageId] ?? [];
        list.push({
          id: d.id,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileType: d.fileType,
          gmailMessageId: d.gmailMessageId,
        });
        attachmentsByMessageId[d.gmailMessageId] = list;
      }
    }
  }

  const emailsForClient = JSON.parse(JSON.stringify(emailRows));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 font-semibold text-[#111827] shadow-sm transition-colors hover:border-[#0D9488]/40 hover:bg-[#F9FAFB] hover:text-[#0D9488]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Properties
        </Link>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#D1D5DB]"
          aria-hidden
        />
        <span className="max-w-[min(100%,28rem)] truncate font-medium text-[#6B7280]">
          {property.address}
        </span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              {property.title}
            </h1>
            <PropertyStatusSelect
              propertyId={id}
              value={property.status}
            />
          </div>
          <p className="text-[#6B7280]">{locationLine(property)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <PropertyShareButton listingUrl={property.listingUrl} />
          <Button
            variant="outline"
            type="button"
            disabled
            className="border-[#E5E7EB] bg-white"
          >
            Edit
          </Button>
        </div>
      </div>

      <PropertyImageGallery
        imageUrl={property.imageUrl}
        imageUrls={property.imageUrls}
      />

      <PropertyAuctionBanner
        auctionDate={property.auctionDate}
        auctionTime={property.auctionTime}
        auctionVenue={property.auctionVenue}
      />

      <Card className="border-[#E5E7EB] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#111827]">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[#6B7280]">Price</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {formatAud(property.price)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#6B7280]">Property type</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {property.propertyType ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#6B7280]">Bedrooms</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {property.bedrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#6B7280]">Bathrooms</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {property.bathrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#6B7280]">Parking</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {property.parking ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[#6B7280]">Listing URL</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {property.listingUrl ? (
                  <a
                    href={property.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#0D9488] hover:underline"
                  >
                    Open listing
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span>—</span>
                )}
              </dd>
            </div>
            {property.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-[#6B7280]">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-[#111827]">
                  {property.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {hasAnyAgentField(property) ? (
        <PropertyAgentSection
          propertyId={id}
          agentId={property.agentId}
          agentName={property.agentName}
          agencyName={property.agencyName}
          agentPhotoUrl={property.agentPhotoUrl}
          agentEmail={property.agentEmail}
          agentPhone={property.agentPhone}
        />
      ) : null}

      <section className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
          Activity
        </h2>
        <PropertyInspectionsSection
          propertyId={id}
          upcoming={inspectionsPack.upcoming}
          past={inspectionsPack.past}
        />
        <PropertyNotesSection propertyId={id} notes={notesList} />
        <PropertyDocumentsSection propertyId={id} documents={docsList} />
        <PropertyEmailsSection
          emails={emailsForClient}
          attachmentsByMessageId={attachmentsByMessageId}
        />
        <PropertyVoiceNotesSection propertyId={id} voiceNotes={voiceList} />
      </section>
    </div>
  );
}
