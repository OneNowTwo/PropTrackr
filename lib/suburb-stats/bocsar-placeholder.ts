import type { SuburbCrime } from "@/lib/suburb-stats/types";

/** BOCSAR suburb pages use a slug; hyphenated lowercase matches most listings. */
export function nswBocsarCrimePlaceholder(suburb: string): SuburbCrime {
  const slug = suburb.toLowerCase().replace(/\s+/g, "-");
  return {
    summary: `View crime statistics for ${suburb} on BOCSAR.`,
    externalUrl: `https://www.bocsar.nsw.gov.au/Pages/bocsar_pages/crime_stat/${slug}.aspx`,
  };
}
