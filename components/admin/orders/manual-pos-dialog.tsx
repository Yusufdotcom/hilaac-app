"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { ItemCustomizeSheet } from "@/components/order/item-customize-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cartItemTotal, cartTotal, type CartItem } from "@/lib/order/cart-types";
import { resolveItemAddOns } from "@/lib/order/resolve-item-addons";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  AddOn,
  Category,
  CategoryAddOn,
  MenuItem,
  MenuItemAddOn,
  OrderType,
  RestaurantTable,
} from "@/types/database";

export type ManualPosMenuBundle = {
  restaurantId: string;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  categories: Category[];
  menuItems: MenuItem[];
  addOns: AddOn[];
  categoryAddOns: CategoryAddOn[];
  menuItemAddOns: MenuItemAddOn[];
  tables: RestaurantTable[];
};

export function ManualPosDialog({
  open,
  onOpenChange,
  menu,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: ManualPosMenuBundle;
  onCreated?: (order: { orderId: string; orderNumber: number | null; total: number }) => void;
}) {
  const defaultType: OrderType =
    menu.dineInEnabled ? "dine-in" : menu.takeawayEnabled ? "takeaway" : "dine-in";

  const [orderType, setOrderType] = useState<OrderType>(defaultType);
  const [tableId, setTableId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("all");

  const availableItems = useMemo(
    () =>
      menu.menuItems.filter(
        (m) =>
          m.is_available &&
          (categoryId === "all" || m.category_id === categoryId)
      ),
    [menu.menuItems, categoryId]
  );

  const tables = useMemo(
    () =>
      [...menu.tables].sort((a, b) =>
        a.table_number.localeCompare(b.table_number, undefined, { numeric: true })
      ),
    [menu.tables]
  );

  function reset() {
    setOrderType(defaultType);
    setTableId("");
    setPhone("");
    setCart([]);
    setCustomizing(null);
    setCategoryId("all");
  }

  function addToCart(item: CartItem) {
    setCart((prev) => [...prev, item]);
  }

  function updateQty(cartId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.cartId === cartId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function removeItem(cartId: string) {
    setCart((prev) => prev.filter((c) => c.cartId !== cartId));
  }

  function tryQuickAdd(item: MenuItem) {
    const addOns = resolveItemAddOns({
      item,
      addOns: menu.addOns,
      categoryAddOns: menu.categoryAddOns,
      menuItemAddOns: menu.menuItemAddOns,
    });
    if (addOns.length > 0) {
      setCustomizing(item);
      return;
    }
    addToCart({
      cartId: crypto.randomUUID(),
      menuItem: item,
      quantity: 1,
      selectedAddOns: [],
      notes: "",
      orderType,
    });
  }

  async function submit() {
    if (cart.length === 0 || busy) return;
    if (orderType === "dine-in" && !tableId) {
      toast.error("Select a table");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/staff/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: menu.restaurantId,
          orderType,
          tableId: orderType === "dine-in" ? tableId : null,
          customerPhone: phone.trim() || null,
          items: cart.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            addOnIds: c.selectedAddOns.map((a) => a.id),
            notes: c.notes || undefined,
          })),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        orderId?: string;
        orderNumber?: number | null;
        total?: number;
      };
      if (!res.ok || !json.orderId) {
        toast.error(json.error || "Could not create order");
        return;
      }
      toast.success(
        `Order ${json.orderNumber != null ? `#${json.orderNumber}` : ""} created — sent to kitchen`
      );
      onCreated?.({
        orderId: json.orderId,
        orderNumber: json.orderNumber ?? null,
        total: json.total ?? 0,
      });
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          onOpenChange(v);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-[var(--admin-border,#E2E8F0)] px-5 py-4 text-left">
            <DialogTitle>New order</DialogTitle>
            <DialogDescription>
              Staff POS — skips Accept and goes straight to kitchen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1.2fr_0.8fr]">
            <div className="min-h-0 space-y-3 overflow-y-auto border-b border-[var(--admin-border,#E2E8F0)] p-4 md:border-b-0 md:border-r">
              <div className="flex flex-wrap gap-2">
                {menu.dineInEnabled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={orderType === "dine-in" ? "default" : "outline"}
                    onClick={() => setOrderType("dine-in")}
                  >
                    Dine-in
                  </Button>
                ) : null}
                {menu.takeawayEnabled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={orderType === "takeaway" ? "default" : "outline"}
                    onClick={() => setOrderType("takeaway")}
                  >
                    Takeaway
                  </Button>
                ) : null}
              </div>

              {orderType === "dine-in" ? (
                <div className="space-y-1.5">
                  <Label>Table</Label>
                  <Select value={tableId} onValueChange={setTableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Table {t.table_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>Customer phone (optional)</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 61xxxxxxx"
                  inputMode="tel"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryId("all")}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs",
                    categoryId === "all"
                      ? "border-[var(--admin-brand)] bg-[var(--admin-brand)] text-white"
                      : "border-[var(--admin-border,#E2E8F0)]"
                  )}
                >
                  All
                </button>
                {menu.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs",
                      categoryId === c.id
                        ? "border-[var(--admin-brand)] bg-[var(--admin-brand)] text-white"
                        : "border-[var(--admin-border,#E2E8F0)]"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => tryQuickAdd(item)}
                    className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] text-left transition hover:border-[var(--admin-brand)]"
                  >
                    <div className="relative h-20 w-20 shrink-0 bg-[var(--admin-bg,#F8FAFC)]">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt=""
                          fill
                          sizes="80px"
                          quality={65}
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--admin-muted,#64748B)]">
                          <UtensilsCrossed className="h-6 w-6 opacity-50" />
                        </div>
                      )}
                    </div>
                    <span className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--admin-text,#0F172A)]">
                          {item.name}
                        </span>
                        <span className="text-xs text-[var(--admin-muted,#64748B)]">
                          {formatCurrency(Number(item.price))}
                        </span>
                      </span>
                      <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-muted,#64748B)]" />
                    </span>
                  </button>
                ))}
                {availableItems.length === 0 ? (
                  <p className="col-span-full py-6 text-center text-sm text-[var(--admin-muted,#64748B)]">
                    No available items
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-col p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--admin-text,#0F172A)]">Cart</p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--admin-muted,#64748B)]">
                    <UtensilsCrossed className="h-8 w-8 opacity-40" />
                    <p className="text-sm">Add items from the menu</p>
                  </div>
                ) : (
                  cart.map((c) => (
                    <div
                      key={c.cartId}
                      className="rounded-xl border border-[var(--admin-border,#E2E8F0)] px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.menuItem.name}</p>
                          {c.selectedAddOns.length > 0 ? (
                            <p className="text-[11px] text-[var(--admin-muted,#64748B)]">
                              {c.selectedAddOns.map((a) => a.name).join(", ")}
                            </p>
                          ) : null}
                          <p className="text-xs text-[var(--admin-muted,#64748B)]">
                            {formatCurrency(cartItemTotal(c))}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => removeItem(c.cartId)}
                          className="rounded p-1 text-[var(--admin-muted,#64748B)] hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border p-1"
                          onClick={() => updateQty(c.cartId, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm">{c.quantity}</span>
                        <button
                          type="button"
                          className="rounded border p-1"
                          onClick={() => updateQty(c.cartId, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 space-y-2 border-t border-[var(--admin-border,#E2E8F0)] pt-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal(cart))}</span>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy || cart.length === 0}
                  onClick={() => void submit()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create order"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {customizing ? (
        <ItemCustomizeSheet
          item={customizing}
          categories={menu.categories}
          addOns={menu.addOns}
          categoryAddOns={menu.categoryAddOns}
          menuItemAddOns={menu.menuItemAddOns}
          orderType={orderType}
          onClose={() => setCustomizing(null)}
          onAdd={(cartItem) => {
            addToCart({ ...cartItem, orderType });
            setCustomizing(null);
          }}
        />
      ) : null}
    </>
  );
}
