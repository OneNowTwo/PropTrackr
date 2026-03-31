"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  GitCompareArrows,
  LayoutDashboard,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/account", label: "Account", icon: UserRound },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-white">
      <div className="flex h-14 items-center border-b border-line px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <span>PropTrackr</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-ink-muted hover:bg-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
