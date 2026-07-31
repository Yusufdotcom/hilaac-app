"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { useOrderAppearanceOptional } from "@/components/order/order-appearance-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveItemAddOns,
  resolveSpecialInstructionsPlaceholder,
} from "@/lib/order/resolve-item-addons";
import { cn, formatCurrency } from "@/lib/utils";
import type { AddOn, Category, CategoryAddOn, MenuItem, MenuItemAddOn } from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";

export function ItemCustomizeSheet({
  item,
  categories,
  addOns,
  categoryAddOns,
  menuItemAddOns,
  orderType,
  initialCartItem,
  onClose,
  onAdd,
  onSave,
}: {
  item: MenuItem;
  categories: Category[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
  menuItemAddOns: MenuItemAddOn[];
  orderType: "dine-in" | "takeaway";
  /** When set, sheet opens in edit mode with existing cart values. */
  initialCartItem?: CartItem | null;
  onClose: () => void;
  onAdd: (cartItem: CartItem) => void;
  onSave?: (cartId: string, updates: Partial<CartItem>) => void;
}) {
  const isEditing = Boolean(initialCartItem);
  const appearance = useOrderAppearanceOptional();

  const [quantity, setQuantity] = useState(initialCartItem?.quantity ?? 1);
  const [selected, setSelected] = useState<AddOn[]>(initialCartItem?.selectedAddOns ?? []);
  const [notes, setNotes] = useState(initialCartItem?.notes ?? "");

  const category = useMemo(
    () => categories.find((c) => c.id === item.category_id) ?? null,
    [categories, item.category_id]
  );

  const availableAddOns = useMemo(
    () =>
      resolveItemAddOns({
        item,
        addOns,
        categoryAddOns,
        menuItemAddOns,
      }),
    [item, addOns, categoryAddOns, menuItemAddOns]
  );

  const notesPlaceholder = resolveSpecialInstructionsPlaceholder(category);

  function toggleAddOn(addOn: AddOn) {
    setSelected((prev) =>
      prev.some((a) => a.id === addOn.id) ? prev.filter((a) => a.id !== addOn.id) : [...prev, addOn]
    );
  }

  const unitPrice = Number(item.price) + selected.reduce((sum, a) => sum + Number(a.price), 0);
  const total = unitPrice * quantity;

  function handleSubmit() {
    if (isEditing && initialCartItem && onSave) {
      onSave(initialCartItem.cartId, {
        quantity,
        selectedAddOns: selected,
        notes,
      });
      onClose();
      return;
    }

    onAdd({
      cartId: crypto.randomUUID(),
      menuItem: item,
      quantity,
      selectedAddOns: selected,
      notes,
      orderType,
    });
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className={cn(
          "order-flow-surface mx-auto flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-3xl border-border bg-background p-0 text-foreground shadow-2xl"
        )}
        data-order-theme={appearance?.theme ?? "light"}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/50 px-5 pb-4 pt-5 pr-12 text-left">
          <SheetTitle className="text-lg font-bold tracking-tight">{item.name}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-4 pt-4">
            <div className="space-y-4">
              <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted shadow-sm">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="(max-width: 512px) 100vw, 512px"
                    quality={70}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <UtensilsCrossed className="h-8 w-8" />
                  </div>
                )}
              </div>

              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

              {availableAddOns.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Ku darso</p>
                  <div className="space-y-2">
                    {availableAddOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/70 p-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selected.some((a) => a.id === addOn.id)}
                            onCheckedChange={() => toggleAddOn(addOn)}
                          />
                          <span>{addOn.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          +{formatCurrency(Number(addOn.price))}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 font-semibold">Tilmaamo gaar ah</p>
                <Textarea
                  placeholder={notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  autoFocus={false}
                  tabIndex={0}
                  className="min-h-[96px] rounded-2xl text-base leading-normal"
                  style={{ fontSize: 16 }}
                />
              </div>

              <div className="flex items-center justify-between pb-2">
                <p className="font-semibold">Quantity</p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-semibold">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <OrderPrimaryButton
              type="button"
              size="lg"
              className="h-14 w-full rounded-2xl text-base font-bold shadow-md"
              onClick={(e) => {
                e.currentTarget.blur();
                handleSubmit();
              }}
            >
              {isEditing ? `Cusubo · ${formatCurrency(total)}` : `Ku rido · ${formatCurrency(total)}`}
            </OrderPrimaryButton>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
