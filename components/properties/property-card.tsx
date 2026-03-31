import Link from "next/link";
import type { ComponentProps } from "react";
import { Bath, BedDouble, Car } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatAud } from "@/lib/utils";
import type { Property, PropertyStatus } from "@/types/property";

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

function formatStatus(status: PropertyStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type PropertyCardProps = {
  property: Property;
  className?: string;
};

export function PropertyCard({ property, className }: PropertyCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card transition-colors hover:border-primary/40",
        className,
      )}
    >
      <CardContent className="p-0">
        <Link
          href={`/properties/${property.id}`}
          className="block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {property.suburb}, {property.state} {property.postcode}
              </p>
              <p className="text-base font-semibold leading-snug text-foreground">
                {property.address}
              </p>
              <p className="text-lg font-semibold tracking-tight text-primary">
                {formatAud(property.price)}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(property.status)}>
              {formatStatus(property.status)}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-primary" aria-hidden />
              <span>{property.bedrooms ?? "—"} bed</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-4 w-4 text-primary" aria-hidden />
              <span>{property.bathrooms ?? "—"} bath</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Car className="h-4 w-4 text-primary" aria-hidden />
              <span>{property.parking ?? "—"} car</span>
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
