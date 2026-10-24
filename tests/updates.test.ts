import { afterEach, expect, it, vi } from "vitest";
import { compareVersions, fetchLatestRelease, isAllowedDownload, parseRelease } from "../src/lib/updates";

const valid = { tag_name: "v0.6.0", draft: false, prerelease: false, assets: [{ name: "Courses.apk", state: "uploaded", size: 1234, digest: `sha256:${"a".repeat(64)}`, browser_download_url: "https://github.com/ptit-dev3313/shopping_list/releases/download/v0.6.0/Courses.apk" }] };
afterEach(() => vi.unstubAllGlobals());
it("compare numériquement les versions, y compris les versions à plusieurs chiffres", () => {
  expect(compareVersions("0.10.0", "v0.9.0")).toBe(1);
  expect(compareVersions("v0.5.0", "0.5.0")).toBe(0);
  expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
  expect(() => compareVersions("0.5.0-beta", "0.4.0")).toThrow();
});
it("propose uniquement les versions stables avec l’APK attendue", () => {
  expect(parseRelease(valid)).toMatchObject({ version: "0.6.0" });
  expect(parseRelease({ ...valid, draft: true })).toBeNull();
  expect(parseRelease({ ...valid, prerelease: true })).toBeNull();
  expect(parseRelease({ ...valid, assets: [] })).toBeNull();
  expect(parseRelease({ ...valid, tag_name: "v9.0.0" })).toBeNull();
});
it("refuse les APK venant d’un autre dépôt, domaine ou protocole", () => {
  for (const url of ["http://github.com/ptit-dev3313/shopping_list/releases/download/v0.6.0/Courses.apk", "https://evil.example/Courses.apk", "https://github.com/other/repo/releases/download/v0.6.0/Courses.apk", "https://github.com/ptit-dev3313/shopping_list/releases/download/v0.6.0/Courses.apk?redirect=bad"]) {
    expect(isAllowedDownload(url)).toBe(false);
    expect(parseRelease({ ...valid, assets: [{ ...valid.assets[0], browser_download_url: url }] })).toBeNull();
  }
});
it("gère l’absence de release et les limites de l’API sans jeton dans l’app", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ status: 403, ok: false });
  vi.stubGlobal("fetch", fetcher);
  expect(await fetchLatestRelease(new AbortController().signal)).toBeNull();
  await expect(fetchLatestRelease(new AbortController().signal)).rejects.toThrow(/limite/);
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
});

it("conserve l’empreinte GitHub et refuse une empreinte mal formée pour le téléchargement intégré", () => {
  expect(parseRelease(valid)?.apkSha256).toBe("a".repeat(64));
  expect(parseRelease({ ...valid, assets: [{ ...valid.assets[0], digest: "sha256:invalid" }] })?.apkSha256).toBeNull();
});
