import Link from "next/link";
import type { ComponentProps } from "react";
import { Bath, BedDouble, Car, Home } from "lucide-react";

import { DeletePropertyButton } from "@/components/properties/delete-property-button";
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
  /** Larger image-forward layout for dashboard grids. */
  variant?: "default" | "featured";
  /** Show delete control (e.g. on /properties grid). */
  showDelete?: boolean;
};

export function PropertyCard({
  property,
  className,
  variant = "default",
  showDelete = false,
}: PropertyCardProps) {
  const imageUrl = property.imageUrl?.trim();
  const featured = variant === "featured";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-xl border-[#E5E7EB] bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        className,
      )}
    >
      {showDelete ? (
        <div
          className="absolute right-2 top-2 z-20 rounded-md border border-[#E5E7EB] bg-white/95 shadow-sm backdrop-blur-[2px]"
          onClick={(e) => e.preventDefault()}
        >
          <DeletePropertyButton propertyId={property.id} variant="compact" />
        </div>
      ) : null}
      <CardContent className="p-0">
        <Link
          href={`/properties/${property.id}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F9FA]"
        >
          <div
            className={cn(
              "relative w-full overflow-hidden bg-[#F3F4F6]",
              featured ? "aspect-[5/4] sm:aspect-[16/10]" : "aspect-[4/3]",
            )}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#6B7280]">
                <Home className="h-12 w-12 opacity-35" strokeWidth={1.25} />
                <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                  No photo
                </span>
              </div>
            )}
          </div>
          <div className={cn("space-y-3", featured ? "p-5 sm:p-6" : "p-5")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={cn(
                    "font-semibold leading-snug text-[#111827]",
                    featured ? "text-lg sm:text-xl" : "text-base",
                  )}
                >
                  {property.address}
                </p>
                <p
                  className={cn(
                    "font-semibold text-[#111827]",
                    featured ? "text-sm sm:text-base" : "text-sm",
                  )}
                >
                  {property.suburb}
                  {property.state || property.postcode
                    ? ` · ${[property.state, property.postcode].filter(Boolean).join(" ")}`
                    : ""}
                </p>
                <p
                  className={cn(
                    "pt-1 font-semibold tabular-nums tracking-tight text-[#0D9488]",
                    featured ? "text-xl sm:text-2xl" : "text-lg",
                  )}
                >
                  {formatAud(property.price)}
                </p>
              </div>
              <Badge
                variant={statusBadgeVariant(property.status)}
                className="shrink-0"
              >
                {formatStatus(property.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-[#E5E7EB] pt-3 text-sm text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-[#0D9488]" aria-hidden />
                <span>{property.bedrooms ?? "—"} bed</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bath className="h-4 w-4 text-[#0D9488]" aria-hidden />
                <span>{property.bathrooms ?? "—"} bath</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Car className="h-4 w-4 text-[#0D9488]" aria-hidden />
                <span>{property.parking ?? "—"} car</span>
              </span>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
