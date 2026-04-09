"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePolling } from "@/hooks/use-polling";
import { cn } from "@/lib/utils";

function initials(first?: string | null, last?: string | null) {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

function timeAgoLabel(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 10) return "Updated just now";
  if (secs < 60) return `Updated ${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins === 1) return "Updated 1 min ago";
  return `Updated ${mins} mins ago`;
}

export function DashboardHeader() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  usePolling(30_000);

  const lastRefreshRef = useRef(Date.now());
  const [agoText, setAgoText] = useState("Updated just now");
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const tick = () => setAgoText(timeAgoLabel(Date.now() - lastRefreshRef.current));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    lastRefreshRef.current = Date.now();
    setAgoText("Updated just now");
  }, []);

  const onManualRefresh = useCallback(() => {
    setSpinning(true);
    lastRefreshRef.current = Date.now();
    setAgoText("Updated just now");
    router.refresh();
    setTimeout(() => setSpinning(false), 1000);
  }, [router]);

  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 sm:px-6">
      <div className="min-w-0 md:hidden">
        <span className="truncate text-sm font-bold tracking-tight text-[#111827]">
          PropTrackr
        </span>
      </div>
      <div className="hidden flex-1 items-center gap-2 md:flex">
        <span className="text-xs text-[#9CA3AF]">{agoText}</span>
        <button
          type="button"
          onClick={onManualRefresh}
          className="inline-flex items-center justify-center rounded-full p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#6B7280]"
          aria-label="Refresh data"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", spinning && "animate-spin")}
          />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-[#0D9488] px-3 font-semibold text-white shadow-sm hover:bg-[#0D9488]/90"
          asChild
        >
          <Link href="/properties/new" aria-label="Add property">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add property</span>
          </Link>
        </Button>
        {!isLoaded ? (
          <div className="h-9 w-9 rounded-full bg-[#F3F4F6] animate-pulse" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 rounded-full pl-1 pr-2 text-foreground hover:bg-muted"
              >
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                  {name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {name}
                  </p>
                  {user?.primaryEmailAddress?.emailAddress && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.primaryEmailAddress.emailAddress}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                asChild
                className="cursor-pointer p-0 focus:bg-transparent"
              >
                <SignOutButton redirectUrl="/landing">
                  <button
                    type="button"
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </button>
                </SignOutButton>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
