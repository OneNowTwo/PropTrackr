/** Calendar day key YYYY-MM-DD in the given IANA timezone (for briefing cache). */
export function getBriefingDayKeyInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export const DEFAULT_BRIEFING_TIMEZONE =
  process.env.BRIEFING_TIMEZONE ?? "Australia/Sydney";
