import { getFollowedSuburbs } from "@/app/actions/suburbs";
import { SuburbsPageClient } from "@/components/suburbs/suburbs-page-client";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";

export default async function SuburbsPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const suburbs = await getFollowedSuburbs();

  return <SuburbsPageClient suburbs={suburbs} />;
}
