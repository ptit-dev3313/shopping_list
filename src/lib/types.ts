export type Unit = "g" | "kg" | "l" | "ml" | "-";

export type Ingredient = {
  id: string;
  name: string;
};

export type LineItem = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
};

export type RecipeLine = {
  id: string;
  recipeId: string;
  quantity: number;
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: LineItem[];
};

export type Shopping = {
  id: string;
  name: string;
  recipes: RecipeLine[];
  extras: LineItem[];
  already: LineItem[];
};

export type BuyItem = {
  id: string;
  checked: boolean;
  line: LineItem;
};

export type BuyList = {
  id: string;
  name: string;
  items: BuyItem[];
};

export type AppData = {
  version: 1;
  recipes: Recipe[];
  shoppings: Shopping[];
  ingredients: Ingredient[];
  lists: BuyList[];
};

export const UNITS: { value: Unit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "l", label: "l" },
  { value: "ml", label: "ml" },
  { value: "-", label: "pièce" },
];

export function emptyData(): AppData {
  return {
    version: 1,
    recipes: [],
    shoppings: [],
    ingredients: [],
    lists: [],
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function parseUnit(value: string): Unit {
  if (value === "g" || value === "kg" || value === "l" || value === "ml" || value === "-") {
    return value;
  }
  return "-";
}
