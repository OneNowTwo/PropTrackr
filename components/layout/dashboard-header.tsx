"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { GraduationCap, LogOut, Plus, RefreshCw } from "lucide-react";
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
import { dispatchOpenOnboardingTutorial } from "@/components/onboarding/onboarding-tutorial";
import { cn } from "@/lib/utils";

function initials(first?: string | null, last?: string | null) {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

type RefreshLabel = "default" | "refreshing" | "justNow";

export function DashboardHeader() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  usePolling(30_000);

  const [refreshLabel, setRefreshLabel] = useState<RefreshLabel>("default");
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      refreshTimersRef.current.forEach(clearTimeout);
      refreshTimersRef.current = [];
    };
  }, []);

  const onManualRefresh = useCallback(() => {
    refreshTimersRef.current.forEach(clearTimeout);
    refreshTimersRef.current = [];

    setRefreshLabel("refreshing");
    router.refresh();

    refreshTimersRef.current.push(
      setTimeout(() => {
        setRefreshLabel("justNow");
        refreshTimersRef.current.push(
          setTimeout(() => setRefreshLabel("default"), 3000),
        );
      }, 1000),
    );
  }, [router]);

  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#E5E7EB] bg-white px-4 sm:gap-3 sm:px-6">
      <div className="min-w-0 md:hidden">
        <span className="truncate text-sm font-bold tracking-tight text-[#111827]">
          PropTrackr
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={refreshLabel === "refreshing"}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border border-teal-500 px-3 py-1.5 text-sm font-semibold text-teal-600 transition-colors",
            "hover:bg-teal-500 hover:text-white",
            "disabled:pointer-events-none disabled:opacity-90",
            "sm:px-4",
          )}
          aria-label={
            refreshLabel === "default"
              ? "Refresh data"
              : refreshLabel === "refreshing"
                ? "Refreshing"
                : "Updated just now"
          }
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 sm:mr-1.5",
              refreshLabel === "refreshing" && "animate-spin",
            )}
            aria-hidden
          />
          <span className="hidden sm:inline">
            {refreshLabel === "refreshing" && "Refreshing..."}
            {refreshLabel === "justNow" && "Updated just now"}
            {refreshLabel === "default" && "\u21BB Refresh"}
          </span>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => dispatchOpenOnboardingTutorial()}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#D1D5DB] bg-white px-2.5 text-sm font-semibold text-[#4B5563] transition-colors",
            "hover:border-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]",
            "sm:px-3",
          )}
          aria-label="Show tutorial"
        >
          <GraduationCap className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline">Tutorial</span>
        </button>
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
