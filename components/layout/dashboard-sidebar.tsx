"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  GitCompareArrows,
  Home,
  LayoutDashboard,
  MapPin,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  showCountBadge?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent", label: "Buyers Aigent", icon: Sparkles },
  {
    href: "/properties",
    label: "Properties",
    icon: Building2,
    showCountBadge: true,
  },
  { href: "/suburbs", label: "Suburbs", icon: MapPin },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/account", label: "Account", icon: UserRound },
];

export function DashboardSidebar({
  propertyCount = 0,
}: {
  propertyCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[#E5E7EB] bg-white md:flex">
      <div className="flex h-[3.25rem] items-center border-b border-[#E5E7EB] px-3">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 text-[#111827] transition-colors hover:bg-[#F8F9FA]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D9488] text-white shadow-sm shadow-[#0D9488]/25">
            <Building2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="truncate text-base font-bold tracking-tight">
            PropTrackr
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3 pb-2">
        {nav.map(({ href, label, icon: Icon, showCountBadge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showBadge = showCountBadge && propertyCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-[#ECFDF5] text-[#0F766E] ring-1 ring-[#0D9488]/35 shadow-sm"
                  : "text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-[#0D9488]" : "",
                )}
              />
              <span className="flex-1">{label}</span>
              {showBadge ? (
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums leading-none",
                    active
                      ? "bg-[#0D9488]/15 text-[#0F766E]"
                      : "bg-[#F3F4F6] text-[#6B7280]",
                  )}
                >
                  {propertyCount > 99 ? "99+" : propertyCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#E5E7EB] p-3 pt-4">
        <Button
          className="h-10 w-full gap-2 bg-[#0D9488] font-semibold text-white hover:bg-[#0D9488]/90"
          asChild
        >
          <Link href="/landing">
            <Home className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            Go to homepage
          </Link>
        </Button>
      </div>
    </aside>
  );
}
