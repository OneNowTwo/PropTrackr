/** Relative time like "2 hours ago" or "in 3 days" (en, auto). */
export function formatRelativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffSec = (date.getTime() - Date.now()) / 1000;
  const absSec = Math.abs(diffSec);
  if (absSec < 45) {
    return rtf.format(Math.round(diffSec), "second");
  }
  const diffMin = diffSec / 60;
  if (Math.abs(diffMin) < 60) {
    return rtf.format(Math.round(diffMin), "minute");
  }
  const diffHour = diffMin / 60;
  if (Math.abs(diffHour) < 24) {
    return rtf.format(Math.round(diffHour), "hour");
  }
  const diffDay = diffHour / 24;
  if (Math.abs(diffDay) < 30) {
    return rtf.format(Math.round(diffDay), "day");
  }
  const diffMonth = diffDay / 30;
  if (Math.abs(diffMonth) < 12) {
    return rtf.format(Math.round(diffMonth), "month");
  }
  return rtf.format(Math.round(diffMonth / 12), "year");
}
