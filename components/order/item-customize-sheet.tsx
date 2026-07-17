"use client";

import { useState } from "react";
import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { AddOn, MenuItem } from "@/types/database";
import type { CartItem } from "@/lib/order/cart-types";

export function ItemCustomizeSheet({
  item,
  addOns,
  orderType,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  addOns: AddOn[];
  orderType: "dine-in" | "takeaway";
  onClose: () => void;
  onAdd: (cartItem: CartItem) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<AddOn[]>([]);
  const [notes, setNotes] = useState("");

  function toggleAddOn(addOn: AddOn) {
    setSelected((prev) =>
      prev.some((a) => a.id === addOn.id) ? prev.filter((a) => a.id !== addOn.id) : [...prev, addOn]
    );
  }

  const unitPrice = Number(item.price) + selected.reduce((sum, a) => sum + Number(a.price), 0);
  const total = unitPrice * quantity;

  function handleAdd() {
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
        className="mx-auto flex max-h-[92vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 space-y-0 px-6 pb-4 pt-6 pr-12 text-left">
          <SheetTitle>{item.name}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-4">
              <div className="relative h-40 w-full overflow-hidden rounded-xl bg-muted">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <UtensilsCrossed className="h-8 w-8" />
                  </div>
                )}
              </div>

              {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

              {addOns.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Ku darso</p>
                  <div className="space-y-2">
                    {addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border p-3"
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
                  placeholder="e.g. No onions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  autoFocus={false}
                  tabIndex={0}
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
                  <Button type="button" variant="outline" size="icon" onClick={() => setQuantity((q) => q + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              size="lg"
              className="h-12 w-full rounded-xl bg-[#D4A373] text-base font-semibold text-[#0F172A] hover:bg-[#D4A373]/90"
              onClick={(e) => {
                e.currentTarget.blur();
                handleAdd();
              }}
            >
              Ku rido · {formatCurrency(total)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
