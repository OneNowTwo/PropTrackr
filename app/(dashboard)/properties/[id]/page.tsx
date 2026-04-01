import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  getDocumentsForPropertySafe,
  getInspectionsForPropertySafe,
  getPropertyForClerkUserSafe,
  getPropertyNotesForPropertySafe,
  getVoiceNotesForPropertySafe,
  isValidPropertyId,
} from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { formatAud } from "@/lib/utils";
import { currentUser } from "@clerk/nextjs/server";
import type { PropertyStatus } from "@/types/property";
import type { ComponentProps } from "react";

type Props = { params: { id: string } };

function formatStatusLabel(status: PropertyStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadgeVariant(
  status: PropertyStatus,
): ComponentProps<typeof Badge>["variant"] {
  switch (status) {
    case "shortlisted":
      return "success";
    case "inspecting":
      return "default";
    case "passed":
      return "muted";
    default:
      return "secondary";
  }
}

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

  const [inspectionsPack, notesList, docsList, voiceList] = await Promise.all([
    getInspectionsForPropertySafe(id),
    getPropertyNotesForPropertySafe(id),
    getDocumentsForPropertySafe(id),
    getVoiceNotesForPropertySafe(id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 w-fit gap-1 text-foreground hover:bg-muted"
            asChild
          >
            <Link href="/properties">
              <ArrowLeft className="h-4 w-4" />
              Back to properties
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
              {property.title}
            </h1>
            <Badge variant={statusBadgeVariant(property.status)}>
              {formatStatusLabel(property.status)}
            </Badge>
          </div>
          <p className="text-[#6B7280]">{locationLine(property)}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled
          className="shrink-0 border-[#E5E7EB] bg-white"
        >
          Edit
        </Button>
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
        <PropertyVoiceNotesSection propertyId={id} voiceNotes={voiceList} />
      </section>
    </div>
  );
}
