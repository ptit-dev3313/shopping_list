import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateProvider } from "../src/context/UpdateContext";
import { UpdateButton } from "../src/components/UpdateButton";

const mocks = vi.hoisted(() => ({ persist: vi.fn(async () => true), openDownload: vi.fn(async () => {}) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android", isNativePlatform: () => false }, registerPlugin: () => ({ openDownload: mocks.openDownload }) }));
vi.mock("../src/context/AppContext", () => ({ useApp: () => ({ persist: mocks.persist }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const latest = { tag_name: "v0.6.0", draft: false, prerelease: false, assets: [{ name: "Courses.apk", state: "uploaded", size: 1234, browser_download_url: "https://github.com/ptit-dev3313/shopping_list/releases/download/v0.6.0/Courses.apk" }] };

it("signale une mise à jour et sauvegarde avant d’ouvrir le téléchargement officiel", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => latest })));
  const user = userEvent.setup();
  render(<UpdateProvider><UpdateButton /></UpdateProvider>);
  await user.click(await screen.findByRole("button", { name: "Mise à jour 0.6.0 disponible" }));
  await user.click(screen.getByRole("button", { name: "Télécharger l’APK" }));
  await waitFor(() => expect(mocks.openDownload).toHaveBeenCalledWith({ url: latest.assets[0].browser_download_url }));
  expect(mocks.persist).toHaveBeenCalledOnce();
  expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(mocks.openDownload.mock.invocationCallOrder[0]);
});

it("laisse l’application utilisable hors ligne et propose de réessayer", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Hors ligne"); }));
  const user = userEvent.setup();
  render(<UpdateProvider><UpdateButton /></UpdateProvider>);
  await user.click(screen.getByRole("button", { name: "Mises à jour" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Vérifier à nouveau" })).toBeTruthy();
  expect(mocks.openDownload).not.toHaveBeenCalled();
});
