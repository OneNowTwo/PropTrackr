"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuburbStats } from "@/components/properties/suburb-stats";

interface PropertyDetailTabsProps {
  children: ReactNode;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

export function PropertyDetailTabs({
  children,
  address,
  suburb,
  state,
  postcode,
}: PropertyDetailTabsProps) {
  return (
    <Tabs defaultValue="activity" className="space-y-6">
      <TabsList className="h-10 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
        <TabsTrigger
          value="activity"
          className="rounded-md px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-[#0D9488] data-[state=active]:shadow-sm"
        >
          Activity
        </TabsTrigger>
        <TabsTrigger
          value="suburb"
          className="rounded-md px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-[#0D9488] data-[state=active]:shadow-sm"
        >
          Suburb
        </TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="space-y-6">
        {children}
      </TabsContent>

      <TabsContent value="suburb">
        <SuburbStats
          address={address}
          suburb={suburb}
          state={state}
          postcode={postcode}
        />
      </TabsContent>
    </Tabs>
  );
}
