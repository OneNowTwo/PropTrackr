import { auth } from "@clerk/nextjs/server";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { getPropertyCountForClerkSafe } from "@/lib/db/queries";

export default async function DashboardRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  const propertyCount = await getPropertyCountForClerkSafe(userId ?? undefined);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar propertyCount={propertyCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
