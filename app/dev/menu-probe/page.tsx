"use client";

import { AdminBrandProvider } from "@/components/admin/admin-brand-context";
import { MenuManager } from "@/components/admin/menu/menu-manager";
import type { AddOn, Category, CategoryAddOn, MenuItem, MenuItemAddOn } from "@/types/database";

const categories: Category[] = [
  {
    id: "cat-1",
    restaurant_id: "r1",
    name: "Mains",
    display_order: 0,
    created_at: new Date().toISOString(),
  },
];

const menuItems: MenuItem[] = [
  {
    id: "item-1",
    restaurant_id: "r1",
    category_id: "cat-1",
    name: "Grilled Chicken",
    description: "With rice and salad",
    ingredients: null,
    price: 12.5,
    image_url: null,
    is_available: true,
    is_top_pick: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "item-2",
    restaurant_id: "r1",
    category_id: "cat-1",
    name: "Fish Plate",
    description: null,
    ingredients: null,
    price: 15,
    image_url: null,
    is_available: true,
    is_top_pick: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const addOns: AddOn[] = [
  {
    id: "ao-1",
    restaurant_id: "r1",
    name: "Extra cheese",
    price: 1.5,
    created_at: new Date().toISOString(),
  },
  {
    id: "ao-2",
    restaurant_id: "r1",
    name: "Spicy sauce",
    price: 0.75,
    created_at: new Date().toISOString(),
  },
];

const categoryAddOns: CategoryAddOn[] = [];
const menuItemAddOns: MenuItemAddOn[] = [];

export default function MenuProbePage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-8">Probe disabled in production.</p>;
  }

  return (
    <AdminBrandProvider brandColor="#9E2E2E">
      <div className="min-h-screen bg-[#F8FAFC] p-6 text-[#0F172A]">
        <p className="mb-4 text-xs text-muted-foreground">
          Menu probe — brand_color #9E2E2E (Baba&apos;s live value)
        </p>
        <MenuManager
          restaurantId="r1"
          categories={categories}
          menuItems={menuItems}
          addOns={addOns}
          categoryAddOns={categoryAddOns}
          menuItemAddOns={menuItemAddOns}
          canUseAi={false}
          canUseMenuIntelligence={true}
          menuIntelligence={null}
        />
      </div>
    </AdminBrandProvider>
  );
}
