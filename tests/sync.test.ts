import { expect, it, vi } from "vitest";
import { Autosave } from "../src/lib/autosave";
import { mergeAppData, RevisionConflict, SpaceAccessError } from "../src/lib/sync";
import { emptyData } from "../src/lib/types";

const fixture = () => ({ ...emptyData(), ingredients: [{ id: "i", name: "sel" }, { id: "j", name: "poivre" }],
  lists: [{ id: "list", name: "courses", items: [
    { id: "a", checked: false, line: { id: "a-line", ingredientId: "i", quantity: 1, unit: "-" as const } },
    { id: "b", checked: false, line: { id: "b-line", ingredientId: "j", quantity: 2, unit: "-" as const } },
  ] }] });
it("fusionne deux cases cochées sur deux téléphones sans perdre l’une des modifications", async () => {
  const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
  local.lists[0].items[0].checked = true; remote.lists[0].items[1].checked = true;
  const save = vi.fn().mockRejectedValueOnce(new RevisionConflict()).mockResolvedValueOnce(7);
  const queue = new Autosave(base, 4, save, vi.fn(), vi.fn(), {
    load: async () => ({ data: remote, revision: 6 }), merge: mergeAppData,
  });
  queue.edit(local);
  expect(await queue.flush()).toBe(true);
  expect(queue.data.lists[0].items.every((item) => item.checked)).toBe(true);
  expect(save.mock.calls[1][1]).toBe(6);
  expect(base.lists[0].items.every((item) => !item.checked)).toBe(true);
});
it("récupère une réponse d’enregistrement perdue sans renvoyer une ancienne version", async () => {
  const base = fixture(), local = structuredClone(base); local.lists[0].items[0].checked = true;
  const save = vi.fn().mockRejectedValueOnce(new Error("Réseau interrompu")).mockRejectedValueOnce(new RevisionConflict());
  const queue = new Autosave(base, 4, save, vi.fn(), vi.fn(), { load: async () => ({ data: local, revision: 5 }), merge: mergeAppData });
  queue.edit(local); expect(await queue.flush()).toBe(false);
  expect(await queue.flush()).toBe(true);
  expect(queue.revision).toBe(5); expect(save).toHaveBeenCalledTimes(2);
});
it("conserve un conflit sur le même champ et arrête les tentatives automatiques", async () => {
  const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
  local.lists[0].items[0].line.quantity = 3; remote.lists[0].items[0].line.quantity = 4;
  const save = vi.fn().mockRejectedValue(new RevisionConflict()), draft = vi.fn();
  const queue = new Autosave(base, 4, save, vi.fn(), draft, { load: async () => ({ data: remote, revision: 5 }), merge: mergeAppData });
  queue.edit(local); expect(await queue.flush()).toBe(false);
  expect(queue.status).toBe("conflict"); expect(queue.data).toBe(local);
  expect(queue.snapshot().base).toEqual(base);
  await queue.flush(); expect(save).toHaveBeenCalledTimes(1); expect(draft).not.toHaveBeenCalledWith(null);
});
it("refuse une fusion sans droit d’accès et conserve le brouillon", async () => {
  const base = fixture(), local = structuredClone(base); local.lists[0].items[0].checked = true;
  const save = vi.fn().mockRejectedValue(new RevisionConflict());
  const queue = new Autosave(base, 4, save, vi.fn(), vi.fn(), { load: async () => { throw new SpaceAccessError("Accès retiré"); }, merge: mergeAppData });
  queue.edit(local); expect(await queue.flush()).toBe(false);
  expect(queue.status).toBe("error"); expect(queue.message).toContain("Accès retiré"); expect(queue.data).toBe(local);
  expect(queue.revision).toBe(4); expect(save).toHaveBeenCalledOnce();
});
it("un ancien brouillon sans base ne peut pas écraser la version distante", () => {
  const remote = fixture(), draft = structuredClone(remote); draft.ingredients[0].name = "ancien sel";
  const save = vi.fn(), queue = new Autosave(remote, 8, save, vi.fn(), vi.fn(), { load: vi.fn(), merge: mergeAppData });
  queue.restore({ data: draft, revision: 4 });
  expect(queue.status).toBe("conflict"); expect(queue.data).toEqual(draft); expect(save).not.toHaveBeenCalled();
});
it("reconnaît un ancien brouillon déjà sauvegardé, même si la révision a changé", () => {
  const remote = fixture(), draft = vi.fn();
  const queue = new Autosave(remote, 8, vi.fn(), vi.fn(), draft, { load: vi.fn(), merge: mergeAppData });
  queue.restore({ data: structuredClone(remote), revision: 4 });
  expect(queue.status).toBe("saved"); expect(queue.dirty).toBe(false); expect(draft).toHaveBeenLastCalledWith(null);
});
it("refuse une suppression d’ingrédient qui invaliderait une nouvelle référence distante", () => {
  const base = fixture(), local = structuredClone(base), remote = structuredClone(base);
  local.ingredients = local.ingredients.filter((item) => item.id !== "i"); local.lists[0].items.shift();
  remote.lists[0].items.push({ id: "c", checked: false, line: { id: "c-line", ingredientId: "i", quantity: 1, unit: "-" } });
  expect(() => mergeAppData(base, local, remote)).toThrow(RevisionConflict);
});
it("préserve un réordonnancement et un ajout indépendant, refuse deux tris incompatibles", () => {
  const base = { ...emptyData(), ingredients: [{ id: "a", name: "a" }, { id: "b", name: "b" }, { id: "c", name: "c" }] };
  const local = structuredClone(base), remote = structuredClone(base); local.ingredients.reverse(); remote.ingredients.push({ id: "d", name: "d" });
  expect(mergeAppData(base, local, remote).ingredients.map((item) => item.id)).toEqual(["c", "b", "a", "d"]);
  remote.ingredients = [base.ingredients[1], base.ingredients[0], base.ingredients[2]];
  expect(() => mergeAppData(base, local, remote)).toThrow(RevisionConflict);
});
it("inclut les modifications faites pendant la relecture distante après un conflit", async () => {
  const base = fixture(), first = structuredClone(base), latest = structuredClone(base), remote = structuredClone(base);
  first.lists[0].items[0].checked = true; latest.lists[0].items[0].checked = true;
  latest.ingredients[0].name = "sel fin"; remote.lists[0].items[1].checked = true;
  let finish!: (remote: { data: typeof base; revision: number }) => void;
  const load = vi.fn(() => new Promise<{ data: typeof base; revision: number }>((resolve) => { finish = resolve; }));
  const save = vi.fn().mockRejectedValueOnce(new RevisionConflict()).mockResolvedValueOnce(6);
  const queue = new Autosave(base, 4, save, vi.fn(), vi.fn(), { load, merge: mergeAppData });
  queue.edit(first); const pending = queue.flush(); await Promise.resolve();
  expect(load).toHaveBeenCalledOnce(); queue.edit(latest);
  finish({ data: remote, revision: 5 }); expect(await pending).toBe(true);
  expect(queue.data.ingredients[0].name).toBe("sel fin");
  expect(queue.data.lists[0].items.every((item) => item.checked)).toBe(true);
});
