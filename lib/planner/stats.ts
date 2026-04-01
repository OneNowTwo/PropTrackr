import type { PlannerInspectionRow } from "@/lib/db/queries";

import {
  inspectionCalendarYmd,
  inspectionTimestampMs,
  nextSaturdayYmdUtc,
} from "./inspection-dates";

export type PlannerStats = {
  upcomingCount: number;
  thisSaturdayCount: number;
  attendedTotal: number;
  propertiesInspectedCount: number;
};

export function computePlannerStats(
  rows: PlannerInspectionRow[],
  now: Date = new Date(),
): PlannerStats {
  const nowMs = now.getTime();
  const satYmd = nextSaturdayYmdUtc(now);
  let upcomingCount = 0;
  let thisSaturdayCount = 0;
  let attendedTotal = 0;
  const attendedPropertyIds = new Set<string>();

  for (const r of rows) {
    if (r.attended) {
      attendedTotal += 1;
      attendedPropertyIds.add(r.propertyId);
    }
    const ts = inspectionTimestampMs(r);
    if (ts >= nowMs) {
      upcomingCount += 1;
      if (inspectionCalendarYmd(r.inspectionDate) === satYmd) {
        thisSaturdayCount += 1;
      }
    }
  }

  return {
    upcomingCount,
    thisSaturdayCount,
    attendedTotal,
    propertiesInspectedCount: attendedPropertyIds.size,
  };
}
