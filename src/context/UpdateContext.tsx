import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { compareVersions, fetchLatestRelease, parseRelease, type AppRelease } from "../lib/updates";

type UpdateState = { installed: string; release: AppRelease | null; checking: boolean; checked: boolean; error: string | null; check: () => Promise<void> };
const Context = createContext<UpdateState | null>(null);
const cacheKey = "courses:release-check:v1";
const interval = 6 * 60 * 60 * 1000;

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(__APP_VERSION__);
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);

  const perform = useCallback(async (force = false) => {
    if (request.current || (!force && Date.now() - lastCheck.current < interval)) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setChecking(true); setError(null);
    try {
      const latest = await fetchLatestRelease(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setRelease(latest); setChecked(true); lastCheck.current = Date.now();
      // Store only public release metadata, never an API token.
      try { localStorage.setItem(cacheKey, JSON.stringify({ at: lastCheck.current, latest })); } catch { /* storage can be unavailable */ }
    } catch (err) {
      if (!alive.current || request.current !== controller) return;
      if (alive.current) setError(err instanceof Error && err.name !== "AbortError" ? err.message : "Vérification interrompue. Réessayez avec une connexion Internet.");
      lastCheck.current = Date.now() - interval + 10 * 60 * 1000;
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        if (alive.current) setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (Capacitor.isNativePlatform()) void NativeApp.getInfo().then((info) => { if (alive.current) setInstalled(info.version); }).catch(() => {});
    try {
      const cache = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      if (cache && typeof cache.at === "number" && cache.at <= Date.now() && Date.now() - cache.at < interval) {
        // Validate cached URLs with the same checks as the server response.
        const cached = cache.latest ? parseRelease({ tag_name: `v${cache.latest.version}`, draft: false, prerelease: false,
          assets: [{ name: "Courses.apk", state: "uploaded", size: 1, browser_download_url: cache.latest.apkUrl,
            digest: cache.latest.apkSha256 ? `sha256:${cache.latest.apkSha256}` : undefined }] }) : null;
        if (!cache.latest || cached) { setRelease(cached); setChecked(true); lastCheck.current = cache.at; }
      }
    } catch { /* ignore corrupt caches */ }
    void perform();
    const onFocus = () => { void perform(); };
    window.addEventListener("focus", onFocus); window.addEventListener("online", onFocus);
    const timer = window.setInterval(onFocus, interval);
    return () => { alive.current = false; request.current?.abort(); request.current = null; clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); };
  }, [perform]);
  let newer: AppRelease | null = null;
  try { if (release && compareVersions(release.version, installed) > 0) newer = release; } catch { /* Ignore unsupported development versions */ }
  return <Context.Provider value={{ installed, release: newer, checking, checked, error, check: () => perform(true) }}>{children}</Context.Provider>;
}

export function useUpdates() {
  const value = useContext(Context);
  if (!value) throw new Error("useUpdates hors UpdateProvider");
  return value;
}
