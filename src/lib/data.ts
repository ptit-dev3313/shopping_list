import { requireLowercaseName, requireName } from "./format";
import type { AppData, BuyList, LineItem, Recipe, Shopping, Unit } from "./types";
import { newId } from "./types";

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function upsertLine(
  lines: LineItem[],
  lineId: string | undefined,
  ingredientId: string,
  quantity: number,
  unit: Unit,
): LineItem[] {
  if (lineId) {
    return lines.map((item) =>
      item.id === lineId ? { ...item, ingredientId, quantity, unit } : item,
    );
  }
  return [...lines, { id: newId(), ingredientId, quantity, unit }];
}

export function ensureIngredient(data: AppData, name: string): { data: AppData; id: string } {
  const trimmed = requireLowercaseName(name);
  const existing = data.ingredients.find(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return { data, id: existing.id };
  const id = newId();
  const ingredients = [...data.ingredients, { id, name: trimmed }];
  return { data: { ...data, ingredients }, id };
}

export function createRecipe(data: AppData, name: string): { data: AppData; id: string } {
  const trimmed = requireLowercaseName(name);
  if (data.recipes.some((recipe) => recipe.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Cette recette existe déjà!");
  }
  const recipe: Recipe = { id: newId(), name: trimmed, ingredients: [] };
  return { data: { ...data, recipes: [recipe, ...data.recipes] }, id: recipe.id };
}

export function renameRecipe(data: AppData, id: string, name: string): AppData {
  const trimmed = requireLowercaseName(name);
  if (
    data.recipes.some(
      (recipe) => recipe.id !== id && recipe.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new Error("Le nom de la recette existe déjà");
  }
  return {
    ...data,
    recipes: data.recipes.map((recipe) =>
      recipe.id === id ? { ...recipe, name: trimmed } : recipe,
    ),
  };
}

export function removeRecipe(data: AppData, id: string): AppData {
  if (data.shoppings.some((shopping) => shopping.recipes.some((line) => line.recipeId === id))) {
    throw new Error("Recette déjà dans une liste d'achats");
  }
  return { ...data, recipes: data.recipes.filter((recipe) => recipe.id !== id) };
}

export function reorderRecipes(data: AppData, from: number, to: number): AppData {
  return { ...data, recipes: moveItem(data.recipes, from, to) };
}

export function reorderRecipeLines(data: AppData, recipeId: string, from: number, to: number): AppData {
  return {
    ...data,
    recipes: data.recipes.map((recipe) =>
      recipe.id === recipeId
        ? { ...recipe, ingredients: moveItem(recipe.ingredients, from, to) }
        : recipe,
    ),
  };
}

export function removeRecipeLine(data: AppData, recipeId: string, lineId: string): AppData {
  return {
    ...data,
    recipes: data.recipes.map((recipe) =>
      recipe.id === recipeId
        ? { ...recipe, ingredients: recipe.ingredients.filter((item) => item.id !== lineId) }
        : recipe,
    ),
  };
}

export function upsertRecipeLine(
  data: AppData,
  recipeId: string,
  lineId: string | undefined,
  name: string,
  quantity: number,
  unit: Unit,
): AppData {
  const { data: withIngredient, id: ingredientId } = ensureIngredient(data, name);
  return {
    ...withIngredient,
    recipes: withIngredient.recipes.map((recipe) =>
      recipe.id === recipeId
        ? {
            ...recipe,
            ingredients: upsertLine(recipe.ingredients, lineId, ingredientId, quantity, unit),
          }
        : recipe,
    ),
  };
}

export function createShopping(data: AppData, name: string): { data: AppData; id: string } {
  const trimmed = requireName(name);
  if (data.shoppings.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("Cette liste d'achats existe déjà!");
  }
  const shopping: Shopping = {
    id: newId(),
    name: trimmed,
    recipes: [],
    extras: [],
    already: [],
  };
  return { data: { ...data, shoppings: [shopping, ...data.shoppings] }, id: shopping.id };
}

export function renameShopping(data: AppData, id: string, name: string): AppData {
  const trimmed = requireName(name);
  if (
    data.shoppings.some(
      (item) => item.id !== id && item.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new Error("Le nom de la liste existe déjà");
  }
  return {
    ...data,
    shoppings: data.shoppings.map((item) => (item.id === id ? { ...item, name: trimmed } : item)),
  };
}

export function removeShopping(data: AppData, id: string): AppData {
  return { ...data, shoppings: data.shoppings.filter((item) => item.id !== id) };
}

export function reorderShoppings(data: AppData, from: number, to: number): AppData {
  return { ...data, shoppings: moveItem(data.shoppings, from, to) };
}

export function upsertShoppingLine(
  data: AppData,
  shoppingId: string,
  slot: "extras" | "already",
  lineId: string | undefined,
  name: string,
  quantity: number,
  unit: Unit,
): AppData {
  const { data: withIngredient, id: ingredientId } = ensureIngredient(data, name);
  return {
    ...withIngredient,
    shoppings: withIngredient.shoppings.map((shopping) =>
      shopping.id === shoppingId
        ? {
            ...shopping,
            [slot]: upsertLine(shopping[slot], lineId, ingredientId, quantity, unit),
          }
        : shopping,
    ),
  };
}

export function removeShoppingLine(
  data: AppData,
  shoppingId: string,
  slot: "extras" | "already",
  lineId: string,
): AppData {
  return {
    ...data,
    shoppings: data.shoppings.map((shopping) =>
      shopping.id === shoppingId
        ? { ...shopping, [slot]: shopping[slot].filter((item) => item.id !== lineId) }
        : shopping,
    ),
  };
}

export function reorderShoppingLines(
  data: AppData,
  shoppingId: string,
  slot: "extras" | "already" | "recipes",
  from: number,
  to: number,
): AppData {
  return {
    ...data,
    shoppings: data.shoppings.map((shopping) => {
      if (shopping.id !== shoppingId) return shopping;
      if (slot === "recipes") {
        return { ...shopping, recipes: moveItem(shopping.recipes, from, to) };
      }
      return { ...shopping, [slot]: moveItem(shopping[slot], from, to) };
    }),
  };
}

export function upsertShoppingRecipe(
  data: AppData,
  shoppingId: string,
  lineId: string | undefined,
  recipeName: string,
  quantity: number,
): AppData {
  const recipe = data.recipes.find(
    (item) => item.name.toLowerCase() === requireName(recipeName).toLowerCase(),
  );
  if (!recipe) throw new Error("Recette introuvable");
  return {
    ...data,
    shoppings: data.shoppings.map((shopping) => {
      if (shopping.id !== shoppingId) return shopping;
      if (lineId) {
        return {
          ...shopping,
          recipes: shopping.recipes.map((line) =>
            line.id === lineId ? { ...line, recipeId: recipe.id, quantity } : line,
          ),
        };
      }
      return {
        ...shopping,
        recipes: [...shopping.recipes, { id: newId(), recipeId: recipe.id, quantity }],
      };
    }),
  };
}

export function removeShoppingRecipe(data: AppData, shoppingId: string, lineId: string): AppData {
  return {
    ...data,
    shoppings: data.shoppings.map((shopping) =>
      shopping.id === shoppingId
        ? { ...shopping, recipes: shopping.recipes.filter((line) => line.id !== lineId) }
        : shopping,
    ),
  };
}

export function addBuyList(data: AppData, list: BuyList): AppData {
  return { ...data, lists: [list, ...data.lists] };
}

export function removeList(data: AppData, id: string): AppData {
  return { ...data, lists: data.lists.filter((list) => list.id !== id) };
}

export function reorderLists(data: AppData, from: number, to: number): AppData {
  return { ...data, lists: moveItem(data.lists, from, to) };
}

export function reorderBuyItems(data: AppData, listId: string, from: number, to: number): AppData {
  return {
    ...data,
    lists: data.lists.map((list) =>
      list.id === listId ? { ...list, items: moveItem(list.items, from, to) } : list,
    ),
  };
}

export function toggleBuyItem(data: AppData, listId: string, itemId: string, checked: boolean): AppData {
  return {
    ...data,
    lists: data.lists.map((list) =>
      list.id === listId
        ? {
            ...list,
            items: list.items.map((item) => (item.id === itemId ? { ...item, checked } : item)),
          }
        : list,
    ),
  };
}

export function ingredientInUse(data: AppData, id: string): boolean {
  return (
    data.recipes.some((recipe) => recipe.ingredients.some((item) => item.ingredientId === id)) ||
    data.shoppings.some(
      (shopping) =>
        shopping.extras.some((item) => item.ingredientId === id) ||
        shopping.already.some((item) => item.ingredientId === id),
    ) ||
    data.lists.some((list) => list.items.some((item) => item.line.ingredientId === id))
  );
}

export function addIngredient(data: AppData, name: string): AppData {
  return ensureIngredient(data, name).data;
}

export function renameIngredient(data: AppData, id: string, name: string): AppData {
  const trimmed = requireLowercaseName(name);
  if (
    data.ingredients.some(
      (item) => item.id !== id && item.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new Error("Ingrédient déjà existant!");
  }
  const ingredients = data.ingredients
    .map((item) => (item.id === id ? { ...item, name: trimmed } : item));
  return { ...data, ingredients };
}

export function deleteIngredient(data: AppData, id: string): AppData {
  if (ingredientInUse(data, id)) {
    throw new Error("Ingrédient déjà utilisé dans une recette, un achat ou une liste");
  }
  return { ...data, ingredients: data.ingredients.filter((item) => item.id !== id) };
}

export function cleanUnusedIngredients(data: AppData): AppData {
  return {
    ...data,
    ingredients: data.ingredients.filter((item) => ingredientInUse(data, item.id)),
  };
}

export function reorderIngredients(data: AppData, from: number, to: number): AppData {
  const ingredients = moveItem(data.ingredients, from, to);
  const ranks = new Map(ingredients.map((item, index) => [item.id, index]));
  return { ...data, ingredients, lists: data.lists.map((list) => ({ ...list,
    items: [...list.items].sort((a, b) => (ranks.get(a.line.ingredientId) ?? Infinity) - (ranks.get(b.line.ingredientId) ?? Infinity)),
  })) };
}

export function renameList(data: AppData, id: string, name: string): AppData {
  const trimmed = requireName(name);
  return { ...data, lists: data.lists.map((list) => list.id === id ? { ...list, name: trimmed } : list) };
}

export function mergeIngredients(data: AppData, sourceId: string, targetId: string, name: string): AppData {
  if (sourceId === targetId || !data.ingredients.some((item) => item.id === sourceId) || !data.ingredients.some((item) => item.id === targetId)) {
    throw new Error("Choisissez deux ingrédients différents.");
  }
  const spelling = requireLowercaseName(name);
  if (data.ingredients.some((item) => item.id !== sourceId && item.id !== targetId && item.name.toLowerCase() === spelling)) {
    throw new Error("Cette orthographe correspond à un troisième ingrédient. Choisissez-le comme destination.");
  }
  const remap = (line: LineItem): LineItem => line.ingredientId === sourceId ? { ...line, ingredientId: targetId } : line;
  return { ...data,
    ingredients: data.ingredients.filter((item) => item.id !== sourceId).map((item) => item.id === targetId ? { ...item, name: spelling } : item),
    recipes: data.recipes.map((recipe) => ({ ...recipe, ingredients: recipe.ingredients.map(remap) })),
    shoppings: data.shoppings.map((shopping) => ({ ...shopping, extras: shopping.extras.map(remap), already: shopping.already.map(remap) })),
    lists: data.lists.map((list) => ({ ...list, items: list.items.map((item) => ({ ...item, line: remap(item.line) })) })),
  };
}

export function scaledRecipeIngredients(recipe: Recipe, quantity: number): LineItem[] {
  return recipe.ingredients.map((item) => ({
    ...item,
    id: `${item.id}-preview`,
    quantity: item.quantity * quantity,
  }));
}

export function listNameStamp(name: string): string {
  const now = new Date();
  const stamp = now.toLocaleString("fr-FR", { hour12: false });
  return `${name} — ${stamp}`;
}

