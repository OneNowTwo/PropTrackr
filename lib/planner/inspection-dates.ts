/** Calendar Y-M-D for an inspection row (matches server Date.UTC storage). */
export function inspectionCalendarYmd(
  inspectionDate: Date | string,
): string {
  const d = new Date(inspectionDate);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inspectionTimestampMs(row: {
  inspectionDate: Date | string;
  inspectionTime: string;
}): number {
  const day = new Date(row.inspectionDate).getTime();
  const [hRaw, mRaw] = row.inspectionTime.split(":");
  const h = Number.parseInt(hRaw ?? "0", 10) || 0;
  const m = Number.parseInt(mRaw ?? "0", 10) || 0;
  return day + (h * 60 + m) * 60 * 1000;
}

/** Monday 00:00 UTC of the week containing `ref` (UTC calendar). */
export function utcMondayOfWeek(ref: Date): Date {
  const d = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function ymdUtc(d: Date): string {
  return inspectionCalendarYmd(d);
}

/** Next Saturday on or after `now` (UTC calendar). */
export function nextSaturdayYmdUtc(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const add = (6 - dow + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return ymdUtc(d);
}
