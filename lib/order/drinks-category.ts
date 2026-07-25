import type { Category, MenuItem } from "@/types/database";

const DRINKS_NAME =
  /\b(drink|drinks|beverage|beverages|cabitaan|cabitaanno|soft\s*drink|juice|juices|soda|coffee|qaxwo|shaah|smoothie)\b/i;

export function isDrinksCategoryName(name: string): boolean {
  return DRINKS_NAME.test(name.trim());
}

/** Food / Cunno = anything that is not a drinks category. */
export function isFoodCategoryName(name: string): boolean {
  return !isDrinksCategoryName(name);
}

export function splitMenuCategories(categories: Category[]): {
  food: Category[];
  drinks: Category[];
} {
  const food: Category[] = [];
  const drinks: Category[] = [];
  for (const c of categories) {
    if (isDrinksCategoryName(c.name)) drinks.push(c);
    else food.push(c);
  }
  return { food, drinks };
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
