/** Slug for Domain / REA URLs (lowercase, hyphenated). */
export function suburbToSlug(suburb: string): string {
  return suburb
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Domain.com.au ptype query value per PropTrackr property type label. */
export function domainPtype(propertyType: string): string {
  const t = propertyType.trim().toLowerCase();
  if (t === "house") return "house";
  if (t === "apartment") return "apartment";
  if (t === "townhouse") return "townhouse";
  if (t === "unit") return "unit";
  if (t === "land") return "residential-land";
  return "house";
}

export function buildDomainSearchUrl(
  suburb: string,
  propertyType: string,
  minPrice: number,
  maxPrice: number,
): string {
  const slug = suburbToSlug(suburb);
  const ptype = domainPtype(propertyType);
  const price = `${minPrice}-${maxPrice}`;
  return `https://www.domain.com.au/sale/?suburb=${slug}-nsw&ptype=${ptype}&price=${price}`;
}

export function buildRealestateSearchUrl(suburb: string): string {
  const slug = suburbToSlug(suburb);
  return `https://www.realestate.com.au/buy/in-${slug},+nsw/list-1`;
}

export const DEFAULT_DISCOVERY_PROPERTY_TYPES = [
  "House",
  "Apartment",
  "Townhouse",
  "Unit",
  "Land",
] as const;
