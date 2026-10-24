import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateProvider } from "../src/context/UpdateContext";
import { UpdateButton } from "../src/components/UpdateButton";

const mocks = vi.hoisted(() => ({ persist: vi.fn(), preserveDraft: vi.fn(), downloadUpdate: vi.fn(), installUpdate: vi.fn(), addListener: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android", isNativePlatform: () => false }, registerPlugin: () => mocks }));
vi.mock("../src/context/AppContext", () => ({ useApp: () => ({ persist: mocks.persist, preserveDraft: mocks.preserveDraft }) }));
const latest = { tag_name: "v0.6.0", draft: false, prerelease: false, assets: [{ name: "Courses.apk", state: "uploaded", size: 1234, digest: `sha256:${"a".repeat(64)}`, browser_download_url: "https://github.com/ptit-dev3313/shopping_list/releases/download/v0.6.0/Courses.apk" }] };
beforeEach(() => {
  mocks.persist.mockResolvedValue(true); mocks.downloadUpdate.mockResolvedValue(undefined); mocks.installUpdate.mockResolvedValue(undefined);
  mocks.preserveDraft.mockReturnValue(false);
  mocks.addListener.mockResolvedValue({ remove: vi.fn() });
  vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => latest })));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
async function openUpdates() {
  render(<UpdateProvider><UpdateButton /></UpdateProvider>);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Mise à jour 0.6.0 disponible" }));
  return user;
}
it("télécharge dans Courses, attend l’enregistrement et ouvre l’installateur Android", async () => {
  const user = await openUpdates();
  await user.click(await screen.findByRole("button", { name: "Mettre à jour maintenant" }));
  await waitFor(() => expect(mocks.installUpdate).toHaveBeenCalledOnce());
  expect(mocks.persist).toHaveBeenCalledTimes(2);
  expect(mocks.downloadUpdate).toHaveBeenCalledWith({ url: latest.assets[0].browser_download_url, sha256: "a".repeat(64) });
  expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(mocks.downloadUpdate.mock.invocationCallOrder[0]);
  expect(mocks.persist.mock.invocationCallOrder[1]).toBeLessThan(mocks.installUpdate.mock.invocationCallOrder[0]);
});
it("réessaie une installation refusée sans télécharger l’APK à nouveau", async () => {
  mocks.installUpdate.mockRejectedValueOnce(new Error("Autorisation non accordée"));
  const user = await openUpdates();
  await user.click(screen.getByRole("button", { name: "Mettre à jour maintenant" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Autorisation non accordée");
  await user.click(screen.getByRole("button", { name: "Installer la mise à jour" }));
  await waitFor(() => expect(mocks.installUpdate).toHaveBeenCalledTimes(2));
  expect(mocks.downloadUpdate).toHaveBeenCalledOnce();
});
it("n’installe rien après un téléchargement interrompu et permet une nouvelle tentative", async () => {
  mocks.downloadUpdate.mockRejectedValueOnce(new Error("Connexion interrompue"));
  const user = await openUpdates();
  await user.click(screen.getByRole("button", { name: "Mettre à jour maintenant" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Connexion interrompue");
  expect(mocks.installUpdate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Mettre à jour maintenant" }));
  await waitFor(() => expect(mocks.installUpdate).toHaveBeenCalledOnce());
});
it("bloque l’installation si les dernières modifications ne sont pas enregistrées", async () => {
  mocks.persist.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const user = await openUpdates();
  await user.click(screen.getByRole("button", { name: "Mettre à jour maintenant" }));
  expect((await screen.findByRole("alert")).textContent).toContain("dernières modifications");
  expect(mocks.downloadUpdate).toHaveBeenCalledOnce();
  expect(mocks.installUpdate).not.toHaveBeenCalled();
});
it("laisse l’application utilisable hors ligne et propose de réessayer", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Hors ligne"); }));
  const user = userEvent.setup();
  render(<UpdateProvider><UpdateButton /></UpdateProvider>);
  await user.click(screen.getByRole("button", { name: "Mises à jour" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Vérifier à nouveau" })).toBeTruthy();
  expect(mocks.downloadUpdate).not.toHaveBeenCalled();
});
it("permet une mise à jour réparatrice si le brouillon est durablement conservé sur l’appareil", async () => {
  mocks.persist.mockResolvedValue(false); mocks.preserveDraft.mockReturnValue(true);
  const user = await openUpdates();
  await user.click(screen.getByRole("button", { name: "Mettre à jour maintenant" }));
  await waitFor(() => expect(mocks.installUpdate).toHaveBeenCalledOnce());
  expect(mocks.preserveDraft).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Votre brouillon est conservé sur cet appareil/)).toBeTruthy();
});
