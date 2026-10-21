import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ native: true, values: new Map<string, string>() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => state.native } }));
vi.mock("@capacitor/preferences", () => ({ Preferences: {
  get: async ({ key }: { key: string }) => ({ value: state.values.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { state.values.set(key, value); },
  remove: async ({ key }: { key: string }) => { state.values.delete(key); },
} }));
beforeEach(() => { vi.resetModules(); state.native = true; state.values.clear(); localStorage.clear(); });

it("conserve la session native après rechargement et la supprime à la déconnexion", async () => {
  const { nativeSessionStorage: storage } = await import("../src/lib/sessionStorage");
  await storage!.setItem("test-session", "fake-session");
  vi.resetModules();
  const { nativeSessionStorage: afterRestart } = await import("../src/lib/sessionStorage");
  expect(await afterRestart!.getItem("test-session")).toBe("fake-session");
  await afterRestart!.removeItem("test-session");
  expect(await afterRestart!.getItem("test-session")).toBeNull();
});

it("migre une session WebView existante vers les préférences natives", async () => {
  localStorage.setItem("test-session", "old-fake-session");
  const { nativeSessionStorage: storage } = await import("../src/lib/sessionStorage");
  expect(await storage!.getItem("test-session")).toBe("old-fake-session");
  expect(state.values.get("test-session")).toBe("old-fake-session");
  expect(localStorage.getItem("test-session")).toBeNull();
});

it("garde le stockage standard de Supabase sur le web", async () => {
  state.native = false;
  const { nativeSessionStorage } = await import("../src/lib/sessionStorage");
  expect(nativeSessionStorage).toBeUndefined();
});
