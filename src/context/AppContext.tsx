import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Autosave, type SaveStatus } from "../lib/autosave";
import { emptyData, type AppData } from "../lib/types";
import { listSpaces, loadRemoteData, saveRemoteData, subscribeToData, supabase, type Space } from "../lib/supabase";

type Toast = { kind: "info" | "error"; message: string } | null;
type Scope = { user: string; space: string; data: AppData; revision: number; dirty: boolean; ready: boolean; queue?: Autosave<AppData> };
type AppContextValue = {
  session: Session | null; data: AppData; loading: boolean; saving: boolean; saveStatus: SaveStatus; saveMessage: string; toast: Toast;
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const saving = saveStatus === "saving";
  const [toast, setToast] = useState<Toast>(null);
  const current = useRef<Scope>(blank());

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

  const draftKey = (scope: Scope) => `courses:draft:${scope.user}:${scope.space}`;
  const attach = useCallback((scope: Scope, payload: AppData, revision: number) => {
    const queue = new Autosave(payload, revision,
      (value, base) => {
        if (current.current !== scope || scope.queue !== queue) return Promise.reject(new Error("L’espace actif a changé."));
        return saveRemoteData(scope.space, value, base);
      },
      () => {
        if (current.current !== scope || (scope.queue && scope.queue !== queue)) return;
        scope.data = queue.data; scope.revision = queue.revision; scope.dirty = queue.dirty;
        setSaveStatus(queue.status); setSaveMessage(queue.message);
      },
      (draft) => {
        if (current.current !== scope || (scope.queue && scope.queue !== queue)) return;
        try {
          if (draft) localStorage.setItem(draftKey(scope), JSON.stringify(draft));
          else localStorage.removeItem(draftKey(scope));
        } catch { /* Cloud saving still works if device storage is full. */ }
      });
    scope.queue = queue; scope.data = payload; scope.revision = revision; scope.dirty = false; scope.ready = true;
    setData(payload); setSaveStatus("saved"); setSaveMessage("");
    return queue;
  }, []);
  const reload = useCallback(async () => {
    const scope = current.current;
    if (!scope.space) return;
    scope.ready = false; setLoading(true);
    // Finish an already started write before explicitly discarding pending edits.
    try {
      if (scope.queue?.status === "saving") await scope.queue.flush();
      const remote = await loadRemoteData(scope.space);
      if (current.current !== scope) return;
      try { localStorage.removeItem(draftKey(scope)); } catch { /* unavailable */ }
      attach(scope, remote.payload, remote.revision);
    } finally {
      if (current.current === scope) { scope.ready = Boolean(scope.queue); setLoading(false); }
    }
  }, [attach]);
  useEffect(() => {
    if (!userId || !spaceId) return;
    let cancelled = false;
    current.current = blank(userId, spaceId);
    setData(emptyData()); setLoading(true);
    const initial = current.current;
    setSaveStatus("saved"); setSaveMessage("");
    void loadRemoteData(spaceId).then((remote) => {
      if (cancelled || current.current !== initial) return;
      const queue = attach(initial, remote.payload, remote.revision);
      try {
        const raw = localStorage.getItem(draftKey(initial));
        if (raw) {
          const draft = JSON.parse(raw) as { data: AppData; revision: number };
          if (draft.data?.version === 1 && Number.isInteger(draft.revision) &&
            [draft.data.ingredients, draft.data.recipes, draft.data.shoppings, draft.data.lists].every(Array.isArray)) {
            // Keep the original base revision: the server will refuse a stale draft.
            queue.revision = draft.revision;
            queue.edit(draft.data); setData(draft.data);
          }
        }
      } catch { /* Ignore an unreadable local draft. */ }
    }).catch((err: Error) => { if (!cancelled) error(err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    const check = async () => {
      if (cancelled) return;
      const scope = current.current;
      if (!scope.ready) return;
      const snapshot = scope.data;
      const revision = scope.revision;
      try {
        const remote = await loadRemoteData(spaceId);
        if (cancelled || current.current !== scope || scope.data !== snapshot || scope.revision !== revision) return;
        if (scope.dirty || scope.queue?.status === "saving") {
          return;
        }
        attach(scope, remote.payload, remote.revision);
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
  }, [userId, spaceId, attach, refreshSpaces, error]);

  const updateData = useCallback((updater: (data: AppData) => AppData) => {
    const scope = current.current;
    if (!scope.ready || !scope.queue) return;
    const next = updater(scope.queue.data);
    if (next === scope.queue.data) return;
    scope.queue.edit(next); setData(next);
  }, []);
  const persist = useCallback(async (notify = false): Promise<boolean> => {
    const scope = current.current;
    const saved = scope.queue ? await scope.queue.flush() : !scope.dirty;
    if (current.current !== scope) return false;
    if (saved && notify) info("Enregistrement terminé");
    if (!saved) error(scope.queue?.message ?? "Enregistrement impossible");
    return saved;
  }, [error, info]);
  useEffect(() => {
    const queue = current.current.queue;
    if (!queue?.dirty || queue.status === "error") return;
    const timer = window.setTimeout(() => {
      if (current.current.ready && current.current.queue === queue) void queue.flush();
    }, 700);
    return () => clearTimeout(timer);
  }, [data]);
  useEffect(() => {
    const retry = () => { const scope = current.current; if (scope.ready && scope.queue?.dirty) void scope.queue.flush(); };
    const leave = () => { if (document.visibilityState === "hidden") retry(); };
    const guard = (event: BeforeUnloadEvent) => {
      if (current.current.queue?.dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    window.addEventListener("beforeunload", guard);
    document.addEventListener("visibilitychange", leave);
    const timer = window.setInterval(retry, 30000);
    return () => {
      clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("focus", retry);
      window.removeEventListener("beforeunload", guard); document.removeEventListener("visibilitychange", leave);
    };
  }, []);
  const switchSpace = useCallback(async (id: string) => {
    if (id === spaceId || !spaces.some((space) => space.id === id)) return;
    if (!await persist()) return;
    current.current.ready = false; setSpaceId(id);
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
  return <AppContext.Provider value={{ session, data, loading, saving, saveStatus, saveMessage, toast, email: session?.user.email,
    spaces, spaceId, setToast, error, info, updateData, persist, reload, resetLocal, refreshSpaces, switchSpace }}>{children}</AppContext.Provider>;
}
export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp hors AppProvider");
  return value;
}
