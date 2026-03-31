import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Home } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getPropertyForClerkUserSafe,
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

  const imageUrl = property.imageUrl?.trim();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 w-fit gap-1 text-ink hover:bg-muted"
            asChild
          >
            <Link href="/properties">
              <ArrowLeft className="h-4 w-4" />
              Back to properties
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {property.title}
            </h1>
            <Badge variant={statusBadgeVariant(property.status)}>
              {formatStatusLabel(property.status)}
            </Badge>
          </div>
          <p className="text-ink-muted">{locationLine(property)}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled
          className="shrink-0 border-line bg-white"
        >
          Edit
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="relative aspect-[21/9] max-h-[320px] w-full bg-muted sm:aspect-[2.4/1]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Home className="h-14 w-14 opacity-35" strokeWidth={1.25} />
              <span className="text-sm font-medium">No photo added</span>
            </div>
          )}
        </div>
      </div>

      <Card className="border-line bg-white shadow-card">
        <CardHeader>
          <CardTitle className="text-base text-ink">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">Price</dt>
              <dd className="text-sm font-medium text-ink">
                {formatAud(property.price)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Property type</dt>
              <dd className="text-sm font-medium text-ink">
                {property.propertyType ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Bedrooms</dt>
              <dd className="text-sm font-medium text-ink">
                {property.bedrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Bathrooms</dt>
              <dd className="text-sm font-medium text-ink">
                {property.bathrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Parking</dt>
              <dd className="text-sm font-medium text-ink">
                {property.parking ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-ink-muted">Photo URL</dt>
              <dd className="text-sm font-medium break-all text-ink">
                {property.imageUrl ? (
                  <a
                    href={property.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {property.imageUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-ink-muted">Listing URL</dt>
              <dd className="text-sm font-medium">
                {property.listingUrl ? (
                  <a
                    href={property.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open listing
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-ink">—</span>
                )}
              </dd>
            </div>
            {property.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink-muted">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {property.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">More</h2>
        <Separator className="bg-line" />
        <div className="grid gap-4 md:grid-cols-2">
          <PlaceholderSection
            title="Inspections"
            description="Schedule open homes and mark attendance — next sprint."
          />
          <PlaceholderSection
            title="Notes"
            description="Structured notes and history per listing — next sprint."
          />
          <PlaceholderSection
            title="Voice notes"
            description="Recordings, transcripts, and AI summaries — next sprint."
          />
          <PlaceholderSection
            title="Documents"
            description="Contracts, reports, and files — next sprint."
          />
        </div>
      </section>
    </div>
  );
}

function PlaceholderSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-line bg-white shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-medium text-ink">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
