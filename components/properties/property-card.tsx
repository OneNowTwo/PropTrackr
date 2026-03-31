import Link from "next/link";
import type { ComponentProps } from "react";
import { Bath, BedDouble, Car, Home } from "lucide-react";

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
  const imageUrl = property.imageUrl?.trim();

  return (
    <Card
      className={cn(
        "group overflow-hidden border-border bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        className,
      )}
    >
      <CardContent className="p-0">
        <Link
          href={`/properties/${property.id}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F9FA]"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Home className="h-10 w-10 opacity-40" strokeWidth={1.25} />
                <span className="text-xs font-medium uppercase tracking-wide opacity-60">
                  No photo
                </span>
              </div>
            )}
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-semibold leading-snug text-foreground">
                  {property.address}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {property.suburb}
                  {property.state || property.postcode
                    ? `, ${[property.state, property.postcode].filter(Boolean).join(" ")}`
                    : ""}
                </p>
                <p className="text-lg font-semibold tracking-tight text-primary">
                  {formatAud(property.price)}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(property.status)} className="shrink-0">
                {formatStatus(property.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
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
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
