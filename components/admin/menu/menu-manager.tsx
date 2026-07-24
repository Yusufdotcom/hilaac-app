"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AddOn, Category, MenuItem } from "@/types/database";
import { CategorySection } from "@/components/admin/menu/category-section";
import { MenuItemSection } from "@/components/admin/menu/menu-item-section";
import { AddOnSection } from "@/components/admin/menu/add-on-section";

export function MenuManager({
  restaurantId,
  categories,
  menuItems,
  addOns,
  canUseAi,
}: {
  restaurantId: string;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  canUseAi: boolean;
}) {
  const [tab, setTab] = useState("items");

  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Menu</h1>
        <p className="text-muted-foreground">Manage your categories, dishes, and add-ons.</p>
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
            canUseAi={canUseAi}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategorySection restaurantId={restaurantId} categories={categories} />
        </TabsContent>

        <TabsContent value="addons">
          <AddOnSection restaurantId={restaurantId} addOns={addOns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
