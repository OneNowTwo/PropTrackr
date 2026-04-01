import { PlannerClient } from "@/components/planner/planner-client";
import {
  getInspectionsForUserSafe,
  getPropertiesForClerkUserSafe,
} from "@/lib/db/queries";
import { computePlannerStats } from "@/lib/planner/stats";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function PlannerPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);

  const [inspections, properties] = await Promise.all([
    getInspectionsForUserSafe(user?.id),
    getPropertiesForClerkUserSafe(user?.id),
  ]);

  const stats = computePlannerStats(inspections);

  return (
    <PlannerClient
      inspections={inspections}
      properties={properties}
      stats={stats}
    />
  );
}
