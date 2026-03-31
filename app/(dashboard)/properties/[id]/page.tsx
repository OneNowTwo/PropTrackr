import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

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

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = params;
  if (!id || !isValidPropertyId(id)) notFound();

  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const property = await getPropertyForClerkUserSafe(id, user?.id);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-3 w-fit gap-1" asChild>
            <Link href="/properties">
              <ArrowLeft className="h-4 w-4" />
              Back to properties
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {property.title}
            </h1>
            <Badge variant={statusBadgeVariant(property.status)}>
              {formatStatusLabel(property.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {property.address}, {property.suburb} {property.state}{" "}
            {property.postcode}
          </p>
        </div>
        <Button variant="outline" type="button" disabled className="shrink-0">
          Edit
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Price</dt>
              <dd className="text-sm font-medium text-foreground">
                {formatAud(property.price)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Property type</dt>
              <dd className="text-sm font-medium text-foreground">
                {property.propertyType ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Bedrooms</dt>
              <dd className="text-sm font-medium text-foreground">
                {property.bedrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Bathrooms</dt>
              <dd className="text-sm font-medium text-foreground">
                {property.bathrooms ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Parking</dt>
              <dd className="text-sm font-medium text-foreground">
                {property.parking ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Listing URL</dt>
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
                  <span className="text-foreground">—</span>
                )}
              </dd>
            </div>
            {property.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {property.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">More</h2>
        <Separator className="bg-border" />
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
    <Card className="border-border bg-card/80">
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
