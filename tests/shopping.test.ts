import { describe, expect, it } from "vitest";
import { plannedList, setStockQuantity, stockRows } from "../src/lib/calc";
import { createRecipe, ensureIngredient, mergeIngredients, renameIngredient, renameList, reorderIngredients } from "../src/lib/data";
import { emptyData, type AppData, type LineItem } from "../src/lib/types";

const line = (id: string, ingredientId: string, quantity: number, unit: LineItem["unit"] = "-"): LineItem => ({ id, ingredientId, quantity, unit });
export function fixture(): AppData {
  return { ...emptyData(), ingredients: [{ id: "salt", name: "sel" }, { id: "tomato", name: "tomates" }, { id: "flour", name: "farine" }],
    recipes: [{ id: "recipe", name: "pizza", ingredients: [line("t", "tomato", 25), line("s", "salt", 10, "g"), line("f", "flour", 1, "kg")] }],
    shoppings: [{ id: "shopping", name: "semaine", recipes: [{ id: "r", recipeId: "recipe", quantity: 2 }], extras: [line("extra", "flour", 500, "g")], already: [] }],
  };
}

describe("quantités à la maison et ordre du catalogue", () => {
  it("multiplie les recettes, regroupe les extras et suit le catalogue", () => {
    const data = fixture();
    expect(stockRows(data, data.shoppings[0])).toMatchObject([
      { ingredientId: "salt", total: 20, unit: "g" }, { ingredientId: "tomato", total: 50 }, { ingredientId: "flour", total: 2.5, unit: "kg" },
    ]);
    expect(plannedList(data, data.shoppings[0]).items.map((item) => item.line.ingredientId)).toEqual(["salt", "tomato", "flour"]);
  });
  it("marque 30 tomates disponibles sur 50, conserve les autres choix et remplace une sélection", () => {
    let data = setStockQuantity(fixture(), "shopping", "tomato", "-", 30);
    data = setStockQuantity(data, "shopping", "salt", "g", 5);
    expect(stockRows(data, data.shoppings[0]).find((row) => row.ingredientId === "tomato")).toMatchObject({ covered: 30, remaining: 20 });
    data = setStockQuantity(data, "shopping", "tomato", "-", 10);
    expect(data.shoppings[0].already).toHaveLength(2);
    expect(plannedList(data, data.shoppings[0]).items.map((item) => item.line.quantity)).toEqual([15, 40, 2.5]);
  });
  it("convertit kg/g, ne mélange pas pièces/grammes et ne produit pas de quantité négative", () => {
    let data = setStockQuantity(fixture(), "shopping", "flour", "g", 500);
    data = setStockQuantity(data, "shopping", "flour", "kg", 1);
    expect(data.shoppings[0].already).toHaveLength(1);
    expect(stockRows(data, data.shoppings[0])[2]).toMatchObject({ total: 2.5, covered: 1, remaining: 1.5 });
    data = setStockQuantity(data, "shopping", "tomato", "g", 999);
    expect(stockRows(data, data.shoppings[0])[1].remaining).toBe(50);
    data = setStockQuantity(data, "shopping", "tomato", "-", 100);
    expect(stockRows(data, data.shoppings[0])[1].remaining).toBe(0);
    expect(plannedList(data, data.shoppings[0]).items.some((item) => item.line.ingredientId === "tomato")).toBe(false);
    data = setStockQuantity(data, "shopping", "tomato", "-", 0);
    expect(stockRows(data, data.shoppings[0])[1].remaining).toBe(50);
    expect(() => setStockQuantity(data, "shopping", "tomato", "-", NaN)).toThrow();
  });
  it("répercute le changement d’ordre du catalogue sans perdre les cases cochées", () => {
    let data = fixture();
    data.lists = [plannedList(data, data.shoppings[0])]; data.lists[0].items[1].checked = true;
    data = reorderIngredients(data, 1, 0);
    expect(data.lists[0].items.map((item) => item.line.ingredientId)).toEqual(["tomato", "salt", "flour"]);
    expect(data.lists[0].items[0].checked).toBe(true);
  });
});

describe("fusion et noms", () => {
  it("met à jour toutes les références sans perdre les quantités ni modifier l’original", () => {
    const data = fixture();
    data.ingredients.push({ id: "duplicate", name: "Tomates" });
    data.recipes.push({ id: "other", name: "salade", ingredients: [line("other-line", "duplicate", 3)] });
    data.shoppings[0].extras.push(line("dup-extra", "duplicate", 5));
    data.shoppings[0].already.push(line("dup-stock", "duplicate", 1));
    data.lists = [{ id: "list", name: "courses", items: [{ id: "checked", checked: true, line: line("dup-buy", "duplicate", 2) }] }];
    const merged = mergeIngredients(data, "duplicate", "tomato", "tomates");
    expect(merged.ingredients.some((item) => item.id === "duplicate")).toBe(false);
    expect(merged.recipes[1].ingredients[0]).toMatchObject({ ingredientId: "tomato", quantity: 3 });
    expect(merged.shoppings[0].extras[1].ingredientId).toBe("tomato");
    expect(merged.shoppings[0].already[0].ingredientId).toBe("tomato");
    expect(merged.lists[0].items[0]).toMatchObject({ checked: true, line: { ingredientId: "tomato", quantity: 2 } });
    expect(data.recipes[1].ingredients[0].ingredientId).toBe("duplicate");
    expect(() => mergeIngredients(data, "duplicate", "tomato", "sel")).toThrow();
  });
  it("refuse les majuscules, retrouve les ingrédients anciens sans doublon et préserve l’ordre au renommage", () => {
    const data = fixture();
    expect(() => ensureIngredient(data, "Tomate")).toThrow(/minuscules/);
    expect(() => createRecipe(data, "Salade")).toThrow(/minuscules/);
    expect(ensureIngredient(data, "tomates").id).toBe("tomato");
    expect(renameIngredient(data, "salt", "sel fin").ingredients.map((item) => item.id)).toEqual(["salt", "tomato", "flour"]);
    data.lists = [{ id: "list", name: "ancien", items: [] }];
    expect(renameList(data, "list", "Nouveau nom").lists[0].name).toBe("Nouveau nom");
  });
});
