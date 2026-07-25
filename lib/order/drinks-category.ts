import type { Category, MenuItem } from "@/types/database";

const DRINKS_NAME =
  /\b(drink|drinks|beverage|beverages|cabitaan|cabitaanno|soft\s*drink|juice|juices|soda)\b/i;

export function isDrinksCategoryName(name: string): boolean {
  return DRINKS_NAME.test(name.trim());
}

export function findDrinksCategory(categories: Category[]): Category | null {
  return categories.find((c) => isDrinksCategoryName(c.name)) ?? null;
}

/** Food = any item whose category is not a drinks category (or has no category). */
export function isFoodMenuItem(
  item: MenuItem,
  categories: Category[]
): boolean {
  if (!item.category_id) return true;
  const cat = categories.find((c) => c.id === item.category_id);
  if (!cat) return true;
  return !isDrinksCategoryName(cat.name);
}
