"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AddOn, Category, CategoryAddOn, MenuItem, MenuItemAddOn } from "@/types/database";
import { CategorySection } from "@/components/admin/menu/category-section";
import { MenuItemSection } from "@/components/admin/menu/menu-item-section";
import { AddOnSection } from "@/components/admin/menu/add-on-section";

export function MenuManager({
  restaurantId,
  categories,
  menuItems,
  addOns,
  categoryAddOns,
  menuItemAddOns,
  canUseAi,
}: {
  restaurantId: string;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
  menuItemAddOns: MenuItemAddOn[];
  canUseAi: boolean;
}) {
  const [tab, setTab] = useState("items");

  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Menu</h1>
        <p className="text-muted-foreground">
          Manage categories, dishes, and category-scoped add-ons.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
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

        <TabsContent value="categories">
          <CategorySection
            restaurantId={restaurantId}
            categories={categories}
            addOns={addOns}
            categoryAddOns={categoryAddOns}
          />
        </TabsContent>

        <TabsContent value="addons">
          <AddOnSection restaurantId={restaurantId} addOns={addOns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
