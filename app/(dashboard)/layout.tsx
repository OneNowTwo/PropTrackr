import { auth } from "@clerk/nextjs/server";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileFab } from "@/components/layout/mobile-fab";
import { MobileNav } from "@/components/layout/mobile-nav";
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
        <main className="w-full max-w-full flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 md:p-6 md:pb-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileFab />
      <MobileNav />
    </div>
  );
}
