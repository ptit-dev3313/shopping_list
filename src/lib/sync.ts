import type { AppData } from "./types";

export class RevisionConflict extends Error {}
export class SpaceAccessError extends Error {}
export const sameData = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every((key) => Object.hasOwn(b, key) &&
    sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
};

// Merge only changes whose original value is known. Never guess on a same-field conflict.
function merge(base: unknown, local: unknown, remote: unknown): unknown {
  if (sameData(local, remote) || sameData(base, remote)) return local;
  if (sameData(base, local)) return remote;
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const ids = (rows: unknown[]) => rows.map((row) => {
      if (!row || typeof row !== "object" || !("id" in row) || typeof row.id !== "string") throw new RevisionConflict();
      return row.id;
    });
    const bi = ids(base), li = ids(local), ri = ids(remote);
    if ([bi, li, ri].some((order) => new Set(order).size !== order.length)) throw new RevisionConflict();
    const bm = new Map(bi.map((id, i) => [id, base[i]])), lm = new Map(li.map((id, i) => [id, local[i]])), rm = new Map(ri.map((id, i) => [id, remote[i]]));
    const values = new Map([...new Set([...bi, ...li, ...ri])].map((id) => [id, merge(bm.get(id), lm.get(id), rm.get(id))]));
    const common = bi.filter((id) => lm.has(id) && rm.has(id));
    const lo = li.filter((id) => common.includes(id)), ro = ri.filter((id) => common.includes(id));
    const localMoved = !sameData(common, lo), remoteMoved = !sameData(common, ro);
    if (localMoved && remoteMoved && !sameData(lo, ro)) throw new RevisionConflict();
    const order = localMoved ? [...li, ...ri] : [...ri, ...li];
    return [...new Set(order)].filter((id) => values.get(id) !== undefined).map((id) => values.get(id));
  }
  if (base && local && remote && typeof base === "object" && typeof local === "object" && typeof remote === "object" &&
      !Array.isArray(base) && !Array.isArray(local) && !Array.isArray(remote)) {
    const b = base as Record<string, unknown>, l = local as Record<string, unknown>, r = remote as Record<string, unknown>;
    return Object.fromEntries([...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])]
      .map((key) => [key, merge(b[key], l[key], r[key])]).filter((entry) => entry[1] !== undefined));
  }
  throw new RevisionConflict();
}

export function mergeAppData(base: AppData | undefined, local: AppData, remote: AppData): AppData {
  if (sameData(local, remote)) return remote;
  if (!base) throw new RevisionConflict("Cet ancien brouillon ne peut pas être fusionné automatiquement.");
  const result = merge(base, local, remote) as AppData;
  // A deletion on one device must not leave new references from the other dangling.
  const ingredients = new Set(result.ingredients.map((item) => item.id));
  const recipes = new Set(result.recipes.map((item) => item.id));
  const lines = [...result.recipes.flatMap((item) => item.ingredients),
    ...result.shoppings.flatMap((item) => [...item.extras, ...item.already]),
    ...result.lists.flatMap((list) => list.items.map((item) => item.line))];
  if (lines.some((item) => !ingredients.has(item.ingredientId)) ||
    result.shoppings.some((item) => item.recipes.some((line) => !recipes.has(line.recipeId)))) throw new RevisionConflict();
  return result;
}
