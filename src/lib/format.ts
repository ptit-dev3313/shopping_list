import type { AppData, LineItem, RecipeLine } from "./types";

export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return "0";
  if (Math.abs(quantity % 1) < 1e-9) return String(Math.round(quantity));
  return quantity.toFixed(3).replace(/\.?0+$/, "");
}

export function parseQuantity(text: string): number {
  const value = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Quantité invalide!");
  }
  return value;
}

export function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom invalide!");
  return trimmed;
}

export function requireLowercaseName(name: string): string {
  const value = requireName(name).normalize("NFC");
  if (value !== value.toLocaleLowerCase("fr")) {
    throw new Error("Utilisez uniquement des minuscules pour les recettes et les ingrédients.");
  }
  return value;
}

export function ingredientName(data: AppData, id: string): string {
  return data.ingredients.find((item) => item.id === id)?.name ?? "?";
}

export function recipeName(data: AppData, id: string): string {
  return data.recipes.find((item) => item.id === id)?.name ?? "?";
}

export function formatLine(data: AppData, item: LineItem): string {
  return `${formatQuantity(item.quantity)} ${item.unit} ${ingredientName(data, item.ingredientId)}`;
}

export function formatRecipeLine(data: AppData, item: RecipeLine): string {
  return `${formatQuantity(item.quantity)} × ${recipeName(data, item.recipeId)}`;
}
