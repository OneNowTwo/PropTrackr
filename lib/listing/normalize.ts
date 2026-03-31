import { AU_STATES, PROPERTY_TYPES } from "@/lib/property-form-constants";

const STATE_ALIASES: Record<string, (typeof AU_STATES)[number]> = {
  nsw: "NSW",
  "new south wales": "NSW",
  vic: "VIC",
  victoria: "VIC",
  qld: "QLD",
  queensland: "QLD",
  sa: "SA",
  "south australia": "SA",
  wa: "WA",
  "western australia": "WA",
  tas: "TAS",
  tasmania: "TAS",
  act: "ACT",
  "australian capital territory": "ACT",
  nt: "NT",
  "northern territory": "NT",
};

export function normalizeAustralianState(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const upper = s.toUpperCase();
  if ((AU_STATES as readonly string[]).includes(upper)) return upper;
  const key = s.toLowerCase().replace(/\./g, "");
  return STATE_ALIASES[key] ?? "";
}

export function normalizePropertyTypeForDb(
  raw: string | null | undefined,
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const match = PROPERTY_TYPES.find(
    (p) => p.toLowerCase() === t.toLowerCase(),
  );
  if (match) return match;
  const lower = t.toLowerCase();
  if (lower.includes("house") && !lower.includes("town")) return "House";
  if (lower.includes("apartment") || lower.includes("apt")) return "Apartment";
  if (lower.includes("townhouse")) return "Townhouse";
  if (lower.includes("unit")) return "Unit";
  if (lower.includes("land") || lower.includes("vacant")) return "Land";
  return "Other";
}
