import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { emptyData, type AppData } from "../lib/types";
import { listSpaces, loadRemoteData, saveRemoteData, subscribeToData, supabase, type Space } from "../lib/supabase";

type Toast = { kind: "info" | "error"; message: string } | null;
type Scope = { user: string; space: string; data: AppData; revision: number; dirty: boolean; ready: boolean };
type AppContextValue = {
  session: Session | null; data: AppData; loading: boolean; saving: boolean; toast: Toast;
  email: string | undefined; spaces: Space[]; spaceId: string | null;
  setToast: (toast: Toast) => void; error: (message: string) => void; info: (message: string) => void;
  updateData: (updater: (data: AppData) => AppData) => void;
  persist: (notify?: boolean) => Promise<boolean>; reload: () => Promise<void>; resetLocal: () => void;
  refreshSpaces: () => Promise<void>; switchSpace: (id: string) => Promise<void>;
};
export const AppContext = createContext<AppContextValue | null>(null);
const blank = (user = "", space = ""): Scope => ({ user, space, data: emptyData(), revision: 0, dirty: false, ready: false });

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const current = useRef<Scope>(blank());
  const inFlight = useRef(false);
  const error = useCallback((message: string) => setToast({ kind: "error", message }), []);
  const info = useCallback((message: string) => setToast({ kind: "info", message }), []);

  useEffect(() => {
    let active = true;
    let eventSeen = false;
    const apply = (next: Session | null) => {
      if (!active) return;
      if (current.current.user !== (next?.user.id ?? "")) {
        current.current = blank(next?.user.id);
        setData(emptyData()); setSpaces([]); setSpaceId(null); setToast(null); setLoading(Boolean(next));
      }
      setSession(next);
    };
    supabase.auth.getSession().then(({ data: result }) => { if (!eventSeen) apply(result.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { eventSeen = true; apply(next); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id;
  const refreshSpaces = useCallback(async () => {
    if (!userId) return;
    const available = await listSpaces(userId);
    if (current.current.user !== userId) return;
    setSpaces(available);
    setSpaceId((id) => available.some((space) => space.id === id) ? id :
      available.find((space) => space.id === "household")?.id ?? `personal:${userId}`);
  }, [userId]);
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    void refreshSpaces().catch((err: Error) => { if (current.current.user === userId) { error(err.message); setLoading(false); } });
  }, [userId, refreshSpaces, error]);

  const reload = useCallback(async () => {
    const scope = current.current;
    if (!scope.space) return;
    const remote = await loadRemoteData(scope.space);
    if (current.current !== scope) return;
    current.current = { ...scope, data: remote.payload, revision: remote.revision, dirty: false, ready: true };
    setData(remote.payload);
  }, []);
  useEffect(() => {
    if (!userId || !spaceId) return;
    let cancelled = false;
    current.current = blank(userId, spaceId);
    setData(emptyData()); setLoading(true);
    void reload().catch((err: Error) => { if (!cancelled) error(err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    const check = async () => {
      if (cancelled) return;
      const scope = current.current;
      try {
        const remote = await loadRemoteData(spaceId);
        if (cancelled || current.current !== scope) return;
        if (scope.dirty || inFlight.current) {
          if (remote.revision !== scope.revision && !inFlight.current) info("Cet espace a changé. Rechargez avant de sauvegarder.");
          return;
        }
        current.current = { ...scope, data: remote.payload, revision: remote.revision, ready: true };
        setData(remote.payload);
      } catch (err) {
        if (cancelled || current.current !== scope) return;
        // A failed request must never erase unsaved edits during a network outage.
        // RLS still rejects every subsequent save after access is revoked.
        error(err instanceof Error ? err.message : "Cet espace est inaccessible.");
        void refreshSpaces().catch(() => {});
      }
    };
    const channel = subscribeToData(spaceId, () => { void check(); });
    const interval = window.setInterval(() => { void check(); }, 30000);
    window.addEventListener("focus", check);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("focus", check); void supabase.removeChannel(channel); };
  }, [userId, spaceId, reload, refreshSpaces, error, info]);

  const updateData = useCallback((updater: (data: AppData) => AppData) => {
    const scope = current.current;
    if (!scope.ready || inFlight.current) return;
    const next = updater(scope.data);
    current.current = { ...scope, data: next, dirty: true }; setData(next);
  }, []);
  const persist = useCallback(async (notify = false): Promise<boolean> => {
    const scope = current.current;
    if (inFlight.current) return false;
    if (!scope.ready) return !scope.dirty;
    if (!scope.dirty) { if (notify) info("Sauvegarde terminée"); return true; }
    inFlight.current = true; setSaving(true);
    try {
      const revision = await saveRemoteData(scope.space, scope.data, scope.revision);
      if (current.current === scope) { current.current = { ...scope, revision, dirty: false }; if (notify) info("Sauvegarde terminée"); }
      return true;
    } catch (err) { if (current.current === scope) error(err instanceof Error ? err.message : "Sauvegarde impossible"); return false; }
    finally { inFlight.current = false; setSaving(false); }
  }, [error, info]);
  const switchSpace = useCallback(async (id: string) => {
    if (id === spaceId || !spaces.some((space) => space.id === id)) return;
    if (!await persist()) return;
    current.current = { ...current.current, ready: false }; setSpaceId(id);
  }, [persist, spaceId, spaces]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh();
        window.dispatchEvent(new Event("focus"));
      } else {
        void persist();
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [persist]);
  const resetLocal = useCallback(() => updateData(() => emptyData()), [updateData]);
  return <AppContext.Provider value={{ session, data, loading, saving, toast, email: session?.user.email,
    spaces, spaceId, setToast, error, info, updateData, persist, reload, resetLocal, refreshSpaces, switchSpace }}>{children}</AppContext.Provider>;
}
export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp hors AppProvider");
  return value;
}
