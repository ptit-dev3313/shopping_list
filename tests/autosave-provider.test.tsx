import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../src/context/AppContext";
import { emptyData } from "../src/lib/types";

const api = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  listSpaces: async () => [{ id: "personal:u", name: "Privé", owner_id: "u" }],
  loadRemoteData: api.load, saveRemoteData: api.save,
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
  vi.useFakeTimers(); localStorage.clear(); api.save.mockReset(); api.load.mockReset();
  api.load.mockResolvedValue({ payload: emptyData(), revision: 4 });
  api.save.mockResolvedValue(5);
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
