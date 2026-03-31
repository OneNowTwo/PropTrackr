"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

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

function initials(first?: string | null, last?: string | null) {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

export function DashboardHeader() {
  const { user, isLoaded } = useUser();

  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-line bg-white px-6">
      {!isLoaded ? (
        <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 gap-2 rounded-full pl-1 pr-2 text-ink hover:bg-muted"
            >
              <Avatar className="h-8 w-8 border border-line">
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
                <p className="text-sm font-medium leading-none text-ink">{name}</p>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.primaryEmailAddress.emailAddress}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer p-0 focus:bg-transparent">
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
    </header>
  );
}
