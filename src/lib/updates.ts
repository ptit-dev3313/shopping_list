import releaseConfig from "../../release.config.json";

export type AppRelease = { version: string; pageUrl: string; apkUrl: string; apkSha256: string | null };
export const releasePage = `https://github.com/${releaseConfig.repository}/releases`;
export const latestReleaseApi = `https://api.github.com/repos/${releaseConfig.repository}/releases/latest`;

export function compareVersions(left: string, right: string): number {
  const parse = (version: string) => {
    if (!/^v?\d+\.\d+\.\d+$/.test(version)) throw new Error("Version non reconnue");
    return version.replace(/^v/, "").split(".").map(Number);
  };
  const a = parse(left); const b = parse(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

export function isAllowedDownload(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password &&
      url.pathname.startsWith(`/${releaseConfig.repository}/releases/download/`) &&
      url.pathname.endsWith(`/${releaseConfig.androidAssetName}`) && !url.search && !url.hash;
  } catch { return false; }
}

export function parseRelease(payload: unknown): AppRelease | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (value.draft !== false || value.prerelease !== false || typeof value.tag_name !== "string" ||
      !/^v?\d+\.\d+\.\d+$/.test(value.tag_name) || !Array.isArray(value.assets)) return null;
  const asset = value.assets.find((item: Record<string, unknown>) => item && item.name === releaseConfig.androidAssetName &&
    item.state === "uploaded" && typeof item.size === "number" && item.size > 0 &&
    typeof item.browser_download_url === "string" && isAllowedDownload(item.browser_download_url));
  if (!asset) return null;
  const version = value.tag_name.replace(/^v/, "");
  const expectedPrefix = `https://github.com/${releaseConfig.repository}/releases/download/${encodeURIComponent(value.tag_name)}/`;
  if (!asset.browser_download_url.startsWith(expectedPrefix)) return null;
  const apkSha256 = typeof asset.digest === "string" && /^sha256:[a-f0-9]{64}$/.test(asset.digest) ? asset.digest.slice(7) : null;
  return { version, pageUrl: `${releasePage}/tag/${encodeURIComponent(value.tag_name)}`, apkUrl: asset.browser_download_url, apkSha256 };
}

export async function fetchLatestRelease(signal: AbortSignal): Promise<AppRelease | null> {
  const result = await fetch(latestReleaseApi, { signal, headers: { Accept: "application/vnd.github+json" }, credentials: "omit" });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error(result.status === 403 || result.status === 429 ? "GitHub limite les vérifications. Réessayez plus tard." : "GitHub est inaccessible pour le moment.");
  return parseRelease(await result.json());
}
