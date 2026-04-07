"use client";

import Link from "next/link";
import { Bath, BedDouble, Car, ExternalLink, Home, MoreHorizontal } from "lucide-react";

import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAud } from "@/lib/utils";
import type { Property, PropertyStatus } from "@/types/property";
import type { ComponentProps } from "react";

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

export function PropertyListRow({ property }: { property: Property }) {
  const imageUrl = property.imageUrl?.trim();
  const listing = property.listingUrl?.trim();

  return (
    <div className="flex items-stretch gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm transition-colors hover:border-[#0D9488]/25">
      <Link
        href={`/properties/${property.id}`}
        className="relative h-[60px] w-[90px] shrink-0 overflow-hidden rounded-lg bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9CA3AF]">
            <Home className="h-6 w-6 opacity-40" strokeWidth={1.25} />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/properties/${property.id}`}
            className="block font-semibold leading-snug text-[#111827] hover:text-[#0D9488]"
          >
            {property.address}
          </Link>
          <p className="text-sm text-[#6B7280]">{property.suburb}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B7280] sm:hidden">
            <span className="font-semibold tabular-nums text-[#0D9488]">
              {formatAud(property.price)}
            </span>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-[#0D9488]" />
              {property.bedrooms ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5 text-[#0D9488]" />
              {property.bathrooms ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-[#0D9488]" />
              {property.parking ?? "—"}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-6 text-sm sm:flex">
          <p className="w-28 text-right font-semibold tabular-nums text-[#0D9488]">
            {formatAud(property.price)}
          </p>
          <div className="flex w-36 justify-between text-[#6B7280]">
            <span className="inline-flex items-center gap-1" title="Bedrooms">
              <BedDouble className="h-4 w-4 text-[#0D9488]" />
              {property.bedrooms ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1" title="Bathrooms">
              <Bath className="h-4 w-4 text-[#0D9488]" />
              {property.bathrooms ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1" title="Parking">
              <Car className="h-4 w-4 text-[#0D9488]" />
              {property.parking ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          <DeletePropertyButton propertyId={property.id} variant="compact" />
          <Badge
            variant={statusBadgeVariant(property.status)}
            className="whitespace-nowrap"
          >
            {formatStatus(property.status)}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#6B7280]"
                aria-label="Quick actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/properties/${property.id}`}>View details</Link>
              </DropdownMenuItem>
              {listing ? (
                <DropdownMenuItem asChild>
                  <a
                    href={listing}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open listing
                  </a>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
