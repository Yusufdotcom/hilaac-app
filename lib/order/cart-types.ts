import type { AddOn, MenuItem } from "@/types/database";

export interface CartItem {
  cartId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedAddOns: AddOn[];
  notes: string;
}

export function cartItemTotal(item: CartItem) {
  const addOnsTotal = item.selectedAddOns.reduce((sum, a) => sum + Number(a.price), 0);
  return (Number(item.menuItem.price) + addOnsTotal) * item.quantity;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + cartItemTotal(item), 0);
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
