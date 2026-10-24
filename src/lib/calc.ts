import { listNameStamp } from "./data";
import type { AppData, BuyItem, BuyList, LineItem, Shopping, Unit } from "./types";
import { newId } from "./types";

type UnitMap = Map<Unit, number>;
type Grouped = Map<string, UnitMap>;

export function normalize(item: Pick<LineItem, "unit" | "quantity">): { unit: Unit; quantity: number } {
  if (item.unit === "kg") return { unit: "g", quantity: item.quantity * 1000 };
  if (item.unit === "l") return { unit: "ml", quantity: item.quantity * 1000 };
  return { unit: item.unit, quantity: item.quantity };
}

function addItems(items: LineItem[]): Grouped {
  const grouped: Grouped = new Map();
  for (const item of items) {
    const { unit, quantity } = normalize(item);
    let units = grouped.get(item.ingredientId);
    if (!units) {
      units = new Map();
      grouped.set(item.ingredientId, units);
    }
    units.set(unit, (units.get(unit) ?? 0) + quantity);
  }
  return grouped;
}

function subtract(add: Grouped, remove: Grouped): Grouped {
  for (const [ingredientId, units] of remove) {
    const existing = add.get(ingredientId);
    if (!existing) continue;
    for (const [unit, quantity] of units) {
      const next = (existing.get(unit) ?? 0) - quantity;
      if (next <= 0) existing.delete(unit);
      else existing.set(unit, next);
    }
  }
  return add;
}

function clean(grouped: Grouped): Grouped {
  for (const units of grouped.values()) {
    const grams = units.get("g");
    if (grams != null && grams >= 1000) {
      units.delete("g");
      units.set("kg", (units.get("kg") ?? 0) + grams / 1000);
    }
    const milliliters = units.get("ml");
    if (milliliters != null && milliliters >= 1000) {
      units.delete("ml");
      units.set("l", (units.get("l") ?? 0) + milliliters / 1000);
    }
  }
  return grouped;
}

function requiredItems(data: AppData, shopping: Shopping): LineItem[] {
  const toAdd: LineItem[] = [...shopping.extras];
  for (const recipeQty of shopping.recipes) {
    const recipe = data.recipes.find((item) => item.id === recipeQty.recipeId);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      toAdd.push({
        id: newId(),
        ingredientId: ingredient.ingredientId,
        quantity: ingredient.quantity * recipeQty.quantity,
        unit: ingredient.unit,
      });
    }
  }
  return toAdd;
}

export type StockRow = { key: string; ingredientId: string; unit: Unit; total: number; covered: number; remaining: number };

export function stockRows(data: AppData, shopping: Shopping): StockRow[] {
  const required = addItems(requiredItems(data, shopping));
  const available = addItems(shopping.already);
  const ranks = new Map(data.ingredients.map((item, index) => [item.id, index]));
  const result: StockRow[] = [];
  for (const [ingredientId, units] of required) {
    for (const [baseUnit, total] of units) {
      if (total <= 0) continue;
      const unit = baseUnit === "g" && total >= 1000 ? "kg" : baseUnit === "ml" && total >= 1000 ? "l" : baseUnit;
      const divisor = unit === "kg" || unit === "l" ? 1000 : 1;
      const covered = Math.min(total, available.get(ingredientId)?.get(baseUnit) ?? 0);
      result.push({ key: `${ingredientId}:${baseUnit}`, ingredientId, unit, total: total / divisor,
        covered: covered / divisor, remaining: Math.max(0, total - covered) / divisor });
    }
  }
  return result.sort((a, b) => (ranks.get(a.ingredientId) ?? Infinity) - (ranks.get(b.ingredientId) ?? Infinity));
}

export function setStockQuantity(data: AppData, shoppingId: string, ingredientId: string, unit: Unit, quantity: number): AppData {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantité invalide !");
  const baseUnit = normalize({ unit, quantity }).unit;
  return { ...data, shoppings: data.shoppings.map((shopping) => shopping.id !== shoppingId ? shopping : {
    ...shopping, already: [
      ...shopping.already.filter((item) => item.ingredientId !== ingredientId || normalize(item).unit !== baseUnit),
      ...(quantity > 0 ? [{ id: newId(), ingredientId, unit, quantity }] : []),
    ],
  }) };
}

export function plannedList(data: AppData, shopping: Shopping): BuyList {
  const grouped = clean(subtract(addItems(requiredItems(data, shopping)), addItems(shopping.already)));
  const items: BuyItem[] = [];
  for (const [ingredientId, units] of grouped) {
    for (const [unit, quantity] of units) {
      if (quantity > 0) {
        items.push({
          id: newId(),
          checked: false,
          line: { id: newId(), ingredientId, quantity, unit },
        });
      }
    }
  }
  const ranks = new Map(data.ingredients.map((item, index) => [item.id, index]));
  items.sort((a, b) => (ranks.get(a.line.ingredientId) ?? Infinity) - (ranks.get(b.line.ingredientId) ?? Infinity));
  return { id: newId(), name: listNameStamp(shopping.name), items };
}
