import type { AddOn, Category, MenuItem } from "@/types/database";
import { isDrinksCategoryName } from "@/lib/order/drinks-category";

export type CategoryAddOnLink = { category_id: string; add_on_id: string };
export type MenuItemAddOnLink = { menu_item_id: string; add_on_id: string };

const GENERIC_PLACEHOLDER = "Any special requests?";
const FOOD_PLACEHOLDER = "e.g. No onions";
const DRINK_PLACEHOLDER = "e.g. No sugar, less ice";
const APPETIZER_PLACEHOLDER = "e.g. Extra spicy";

/**
 * Resolve which add-ons to show for an item:
 * - use_custom_add_ons → menu_item_add_ons only
 * - else → category_add_ons for the item's category
 * - no category / empty set → []
 */
export function resolveItemAddOns(options: {
  item: MenuItem;
  addOns: AddOn[];
  categoryAddOns: CategoryAddOnLink[];
  menuItemAddOns: MenuItemAddOnLink[];
}): AddOn[] {
  const { item, addOns, categoryAddOns, menuItemAddOns } = options;
  const byId = new Map(addOns.map((a) => [a.id, a]));

  let ids: string[];
  if (item.use_custom_add_ons) {
    ids = menuItemAddOns
      .filter((l) => l.menu_item_id === item.id)
      .map((l) => l.add_on_id);
  } else if (item.category_id) {
    ids = categoryAddOns
      .filter((l) => l.category_id === item.category_id)
      .map((l) => l.add_on_id);
  } else {
    ids = [];
  }

  return ids
    .map((id) => byId.get(id))
    .filter((a): a is AddOn => Boolean(a));
}

export function resolveSpecialInstructionsPlaceholder(
  category: Category | null | undefined
): string {
  const custom = category?.special_instructions_placeholder?.trim();
  if (custom) return custom;

  if (!category) return GENERIC_PLACEHOLDER;

  const name = category.name;
  if (isDrinksCategoryName(name) || /\b(coffee|qaxwo|shaah|smoothie)\b/i.test(name)) {
    return DRINK_PLACEHOLDER;
  }
  if (/\b(appetizer|appetizers|starter|starters|side|sides)\b/i.test(name)) {
    return APPETIZER_PLACEHOLDER;
  }
  if (/\b(burger|food|cunno|grill|pizza|main|meal)\b/i.test(name)) {
    return FOOD_PLACEHOLDER;
  }
  return GENERIC_PLACEHOLDER;
}
