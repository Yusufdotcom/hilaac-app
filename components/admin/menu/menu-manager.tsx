"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AddOn, Category, CategoryAddOn, MenuItem, MenuItemAddOn } from "@/types/database";
import { AdminPageIntro } from "@/components/admin/admin-page-intro";
import { CategorySection } from "@/components/admin/menu/category-section";
import { MenuItemSection } from "@/components/admin/menu/menu-item-section";
import { AddOnSection } from "@/components/admin/menu/add-on-section";
import { MenuIntelligencePanel } from "@/components/admin/menu/menu-intelligence-panel";
import type { MenuIntelligenceResult } from "@/lib/menu/menu-intelligence";

export function MenuManager({
  restaurantId,
  categories,
  menuItems,
  addOns,
  categoryAddOns,
  menuItemAddOns,
  canUseAi,
  canUseMenuIntelligence,
  menuIntelligence,
}: {
  restaurantId: string;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
  menuItemAddOns: MenuItemAddOn[];
  canUseAi: boolean;
  canUseMenuIntelligence: boolean;
  menuIntelligence: MenuIntelligenceResult | null;
}) {
  const [tab, setTab] = useState("categories");

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5">
      <AdminPageIntro>
        Set up categories and add-ons first, then build menu items.
      </AdminPageIntro>

      <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0 space-y-4">
        <TabsList className="admin-surface h-auto w-full flex-wrap justify-start gap-1 border sm:w-auto">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="intelligence">Menu Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-0 focus-visible:ring-0">
          <CategorySection
            restaurantId={restaurantId}
            categories={categories}
            addOns={addOns}
            categoryAddOns={categoryAddOns}
          />
        </TabsContent>

        <TabsContent value="addons" className="mt-0 focus-visible:ring-0">
          <AddOnSection restaurantId={restaurantId} addOns={addOns} />
        </TabsContent>

        <TabsContent value="items" className="mt-0 focus-visible:ring-0">
          <MenuItemSection
            restaurantId={restaurantId}
            categories={categories}
            menuItems={menuItems}
            addOns={addOns}
            categoryAddOns={categoryAddOns}
            menuItemAddOns={menuItemAddOns}
            canUseAi={canUseAi}
          />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-0 focus-visible:ring-0">
          <MenuIntelligencePanel
            data={menuIntelligence}
            gated={!canUseMenuIntelligence}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
