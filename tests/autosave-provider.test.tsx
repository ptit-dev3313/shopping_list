import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../src/context/AppContext";
import { emptyData } from "../src/lib/types";

const api = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn(), create: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  listSpaces: async () => [{ id: "personal:u", name: "Privé", owner_id: "u" }],
  loadRemoteData: api.load, saveRemoteData: api.save,
  createSpace: api.create,
  subscribeToData: () => ({}),
  supabase: { removeChannel: vi.fn(), auth: {
    getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  } },
}));

let app: ReturnType<typeof useApp>;
function Harness() {
  app = useApp();
  return <output>{app.saveStatus}:{app.data.ingredients.length}</output>;
}
async function settle() { await act(async () => { await Promise.resolve(); }); }
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); api.save.mockReset(); api.load.mockReset(); api.create.mockReset();
  api.load.mockResolvedValue({ payload: emptyData(), revision: 4 });
  api.save.mockResolvedValue(5);
});

it("conserve l’ancien brouillon dans un espace séparé avant de reprendre le cloud", async () => {
  const local = { ...emptyData(), ingredients: [{ id: "old", name: "sel local" }] };
  const remote = { ...emptyData(), ingredients: [{ id: "remote", name: "poivre partagé" }] };
  localStorage.setItem("courses:draft:u:personal:u", JSON.stringify({ data: local, revision: 1 }));
  api.load.mockImplementation(async (id) => ({ payload: id === "recovery" ? emptyData() : remote, revision: id === "recovery" ? 0 : 8 }));
  api.create.mockResolvedValue({ id: "recovery", name: "récupération", owner_id: "u" });
  render(<AppProvider><Harness /></AppProvider>); await settle();
  expect(app.saveStatus).toBe("conflict");
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(api.save).not.toHaveBeenCalled();
  await act(async () => { await app.recoverDraft(); });
  expect(api.save).toHaveBeenCalledWith("recovery", local, 0);
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(app.data).toEqual(remote); expect(app.saveStatus).toBe("saved");
  expect(localStorage.getItem("courses:draft:u:personal:u")).toBeNull();
});

it("ne supprime jamais l’ancien brouillon si sa copie échoue", async () => {
  const local = { ...emptyData(), ingredients: [{ id: "old", name: "sel local" }] };
  const raw = JSON.stringify({ data: local, revision: 1 });
  localStorage.setItem("courses:draft:u:personal:u", raw);
  api.create.mockResolvedValue({ id: "recovery", name: "récupération", owner_id: "u" });
  api.save.mockRejectedValue(new Error("Réseau coupé"));
  render(<AppProvider><Harness /></AppProvider>); await settle();
  await act(async () => { await app.recoverDraft(); });
  expect(localStorage.getItem("courses:draft:u:personal:u")).toBe(raw);
  expect(app.data).toEqual(local); expect(app.saveStatus).toBe("conflict");
  expect(app.preserveDraft()).toBe(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("regroupe les modifications et enregistre automatiquement sans bouton", async () => {
  render(<AppProvider><Harness /></AppProvider>); await settle();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(api.save).not.toHaveBeenCalled();
  act(() => app.updateData((data) => ({ ...data, ingredients: [{ id: "i", name: "sel" }] })));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  act(() => app.updateData((data) => ({ ...data, ingredients: [...data.ingredients, { id: "j", name: "poivre" }] })));
  await act(async () => { await vi.advanceTimersByTimeAsync(699); });
  expect(api.save).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("courses:draft:u:personal:u")!).data.ingredients).toHaveLength(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(api.save.mock.calls[0][1].ingredients).toHaveLength(2);
  expect(screen.getByText("saved:2")).toBeTruthy();
  expect(localStorage.getItem("courses:draft:u:personal:u")).toBeNull();
});

it("restaure le brouillon du bon compte et reprend l’envoi après reconnexion", async () => {
  const payload = { ...emptyData(), ingredients: [{ id: "i", name: "sel" }] };
  localStorage.setItem("courses:draft:other:personal:u", JSON.stringify({ data: emptyData(), revision: 0 }));
  localStorage.setItem("courses:draft:u:personal:u", JSON.stringify({ data: payload, revision: 4 }));
  api.save.mockRejectedValueOnce(new Error("Hors ligne"));
  render(<AppProvider><Harness /></AppProvider>); await settle();
  expect(screen.getByText("pending:1")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(700); });
  expect(screen.getByText("error:1")).toBeTruthy();
  expect(localStorage.getItem("courses:draft:u:personal:u")).not.toBeNull();
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(screen.getByText("saved:1")).toBeTruthy();
  expect(api.save).toHaveBeenLastCalledWith("personal:u", payload, 4);
  expect(localStorage.getItem("courses:draft:other:personal:u")).not.toBeNull();
});
