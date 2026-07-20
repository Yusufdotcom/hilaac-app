"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Star, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import type { Category, MenuItem } from "@/types/database";
import { MenuItemDialog } from "@/components/admin/menu/menu-item-dialog";

export function MenuItemSection({
  restaurantId,
  categories,
  menuItems,
  canUseAi,
}: {
  restaurantId: string;
  categories: Category[];
  menuItems: MenuItem[];
  canUseAi: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  function openCreate() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function toggleAvailable(item: MenuItem) {
    const { error } = await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  async function toggleTopPick(item: MenuItem) {
    const { error } = await supabase.from("menu_items").update({ is_top_pick: !item.is_top_pick }).eq("id", item.id);
    if (error) return toast.error(error.message);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Menu item deleted");
    router.refresh();
  }

  function categoryName(id: string | null) {
    return categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <BrandButton onClick={openCreate} disabled={categories.length === 0}>
          <Plus className="h-4 w-4" /> Add Menu Item
        </BrandButton>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">Create a category first before adding menu items.</p>
      )}

      {menuItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <UtensilsCrossed className="h-8 w-8" />
          No menu items yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="relative h-36 w-full bg-muted">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <UtensilsCrossed className="h-8 w-8" />
                  </div>
                )}
                {item.is_top_pick && (
                  <Badge className="absolute left-2 top-2 gap-1">
                    <Star className="h-3 w-3 fill-current" /> Top Pick
                  </Badge>
                )}
                {!item.is_available && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                    Unavailable
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold leading-tight">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{categoryName(item.category_id)}</p>
                  </div>
                  <p className="whitespace-nowrap font-bold text-primary">{formatCurrency(Number(item.price))}</p>
                </div>
                {item.description && <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={item.is_available} onCheckedChange={() => toggleAvailable(item)} />
                    Available
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(item.is_top_pick && "text-amber-500")}
                      onClick={() => toggleTopPick(item)}
                      title="Toggle top pick"
                    >
                      <Star className={cn("h-4 w-4", item.is_top_pick && "fill-current")} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        restaurantId={restaurantId}
        categories={categories}
        item={editingItem}
        canUseAi={canUseAi}
      />
    </div>
  );
}
