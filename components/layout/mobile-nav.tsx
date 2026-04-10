"use client";

import {
  Building2,
  CalendarDays,
  GitCompareArrows,
  Home,
  MapPin,
  Menu,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/suburbs", label: "Suburbs", icon: MapPin },
  { href: "/planner", label: "Planner", icon: CalendarDays },
] as const;

const MORE_ITEMS = [
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/account", label: "Account", icon: UserRound },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const moreActive = MORE_ITEMS.some((item) => isActive(item.href));

  return (
    <>
      {/* More drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
              <span className="text-sm font-semibold text-[#111827]">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive(href)
                      ? "bg-[#ECFDF5] text-[#0F766E]"
                      : "text-[#374151] hover:bg-[#F9FAFB]",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive(href) ? "text-[#0D9488]" : "text-[#9CA3AF]")} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E7EB] bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex h-14 items-stretch">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5"
              >
                <Icon
                  className={cn("h-5 w-5", active ? "text-[#0D9488]" : "text-[#9CA3AF]")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    active ? "text-[#0D9488]" : "text-[#9CA3AF]",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5"
          >
            <Menu
              className={cn("h-5 w-5", moreActive ? "text-[#0D9488]" : "text-[#9CA3AF]")}
              strokeWidth={moreActive ? 2.25 : 1.75}
            />
            <span
              className={cn(
                "text-[10px] font-medium leading-tight",
                moreActive ? "text-[#0D9488]" : "text-[#9CA3AF]",
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
