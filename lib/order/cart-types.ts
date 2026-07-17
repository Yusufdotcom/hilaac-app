import type { AddOn, MenuItem, OrderType } from "@/types/database";

export interface SessionSelection {
  dineIn: boolean;
  takeaway: boolean;
}

export interface CartItem {
  cartId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedAddOns: AddOn[];
  notes: string;
  orderType: OrderType;
}

export function defaultOrderTypeForSession(selection: SessionSelection): OrderType {
  if (selection.dineIn) return "dine-in";
  return "takeaway";
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

export function cartItemsByType(items: CartItem[], orderType: OrderType) {
  return items.filter((item) => item.orderType === orderType);
}

export function cartHasOrderType(items: CartItem[], orderType: OrderType) {
  return items.some((item) => item.orderType === orderType);
}

export function sessionAllowsBothTypes(selection: SessionSelection) {
  return selection.dineIn && selection.takeaway;
}
