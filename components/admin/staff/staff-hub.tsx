"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffAccountsManager } from "@/components/admin/staff/staff-accounts-manager";
import { WaiterManager } from "@/components/admin/staff/waiter-manager";
import { StaffAccessBoard } from "@/components/admin/staff-access/staff-access-board";
import type { Profile, Waiter } from "@/types/database";

const TABS = ["accounts", "access", "waiters"] as const;
type StaffTab = (typeof TABS)[number];

function parseTab(value: string | null): StaffTab {
  if (value === "access" || value === "waiters" || value === "accounts") return value;
  return "accounts";
}

export function StaffHub({
  restaurantId,
  slug,
  appUrl,
  restaurantName,
  staff,
  waiters,
}: {
  restaurantId: string;
  slug: string;
  appUrl: string;
  restaurantName: string;
  staff: Pick<Profile, "id" | "full_name" | "role" | "phone" | "is_active">[];
  waiters: Waiter[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<StaffTab>(() => parseTab(searchParams.get("tab")));

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function onTabChange(next: string) {
    const parsed = parseTab(next);
    setTab(parsed);
    const params = new URLSearchParams(searchParams.toString());
    if (parsed === "accounts") params.delete("tab");
    else params.set("tab", parsed);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage login accounts, floor dashboard links, and waiter display names in one place.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full min-w-0 space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="access">Dashboard Access</TabsTrigger>
          <TabsTrigger value="waiters">Waiter Names</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-0 space-y-4 focus-visible:ring-0">
          <StaffAccountsManager restaurantId={restaurantId} staff={staff} />
        </TabsContent>

        <TabsContent value="access" className="mt-0 focus-visible:ring-0">
          <StaffAccessBoard
            slug={slug}
            appUrl={appUrl}
            restaurantName={restaurantName}
            embedded
          />
        </TabsContent>

        <TabsContent value="waiters" className="mt-0 focus-visible:ring-0">
          <WaiterManager restaurantId={restaurantId} waiters={waiters} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
