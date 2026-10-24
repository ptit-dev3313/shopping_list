import { createClient } from "@supabase/supabase-js";
import { emptyData, type AppData } from "./types";
import { nativeSessionStorage } from "./sessionStorage";
import { RevisionConflict, SpaceAccessError } from "./sync";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquent.");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: nativeSessionStorage,
  },
});

function authMessage(error: { message: string; code?: string }): string {
  const text = error.message.toLowerCase();
  if (text.includes("signup_not_allowed") || text.includes("not allowed")) {
    return "Cet e-mail n’est pas autorisé.";
  }
  if (text.includes("database error saving new user")) {
    return "Inscription impossible. Vérifiez que cette adresse figure dans la liste autorisée dans Supabase, puis réessayez.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Ce compte existe déjà. Connecte-toi.";
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "E-mail ou mot de passe incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirme d’abord ton e-mail en cliquant sur le lien reçu.";
  }
  return error.message;
}

function redirectTo(): string {
  return `${window.location.origin}/`;
}

export async function signUpWithPassword(email: string, password: string): Promise<"created" | "exists"> {
  const trimmed = email.trim();
  if (password.length < 6) {
    throw new Error("Le mot de passe doit faire au moins 6 caractères.");
  }
  const { data, error } = await supabase.auth.signUp({
    email: trimmed,
    password,
    options: { emailRedirectTo: redirectTo() },
  });
  if (error) throw new Error(authMessage(error));
  if (data.user?.identities?.length === 0) {
    return "exists";
  }
  return "created";
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const trimmed = email.trim();
  const { error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) throw new Error(authMessage(error));
}

export function parseAppData(payload: unknown): AppData {
  if (!payload || typeof payload !== "object") return emptyData();
  const value = payload as Partial<AppData>;
  if (value.version !== 1) return emptyData();
  return {
    version: 1,
    recipes: Array.isArray(value.recipes) ? value.recipes : [],
    shoppings: Array.isArray(value.shoppings) ? value.shoppings : [],
    ingredients: Array.isArray(value.ingredients) ? value.ingredients : [],
    lists: Array.isArray(value.lists) ? value.lists : [],
  };
}

export type Space = { id: string; name: string; owner_id: string };
export type Invitation = { space_id: string; email: string; user_id: string | null };
export type RemoteData = { payload: AppData; revision: number };

export async function listSpaces(userId: string): Promise<Space[]> {
  // A deterministic private ID also makes initialization safe across tabs.
  const id = `personal:${userId}`;
  const existing = await supabase.from("app_state").select("id").eq("id", id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) {
    const created = await supabase.from("app_state").insert({ id, name: "Mon espace privé", owner_id: userId, payload: emptyData() });
    if (created.error && created.error.code !== "23505") throw new Error(created.error.message);
  }
  const { data, error } = await supabase.from("app_state").select("id,name,owner_id").order("id");
  if (error) throw new Error(error.message);
  return data;
}

export async function createSpace(name: string): Promise<Space> {
  const { data, error } = await supabase.from("app_state").insert({ name: name.trim(), payload: emptyData() }).select("id,name,owner_id").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameSpace(spaceId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error("Le nom doit contenir entre 1 et 100 caractères.");
  const { error } = await supabase.from("app_state").update({ name: trimmed }).eq("id", spaceId).select("id").single();
  if (error) throw new Error(error.message);
}

export async function listInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase.from("space_invitations").select("space_id,email,user_id");
  if (error) throw new Error(error.message);
  return data;
}

export async function inviteToSpace(spaceId: string, email: string): Promise<void> {
  const { error } = await supabase.from("space_invitations").insert({ space_id: spaceId, email: email.trim().toLowerCase() });
  if (error) throw new Error(error.code === "23505" ? "Cette personne est déjà invitée." : error.message);
}

export async function acceptInvitation(spaceId: string, email: string, userId: string): Promise<void> {
  const { data, error } = await supabase.from("space_invitations").update({ user_id: userId }).eq("space_id", spaceId).eq("email", email).select("space_id").single();
  if (error || !data) throw new Error(error?.message ?? "Invitation introuvable");
}

export async function removeInvitation(spaceId: string, email: string): Promise<void> {
  const { error } = await supabase.from("space_invitations").delete().eq("space_id", spaceId).eq("email", email);
  if (error) throw new Error(error.message);
}

export async function loadRemoteData(spaceId: string): Promise<RemoteData> {
  const { data, error } = await supabase.from("app_state").select("payload,revision").eq("id", spaceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SpaceAccessError("Cet espace est inaccessible : vérifiez votre invitation ou reconnectez-vous. Votre brouillon reste sur cet appareil.");
  return { payload: parseAppData(data.payload), revision: data.revision };
}

export async function saveRemoteData(spaceId: string, payload: AppData, revision: number): Promise<number> {
  const { data, error } = await supabase.from("app_state").update({ payload }).eq("id", spaceId).eq("revision", revision).select("revision").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new RevisionConflict("L’espace a changé depuis votre dernière lecture.");
  return data.revision;
}

export function subscribeToData(spaceId: string, onChange: () => void) {
  return supabase.channel(`app_state:${spaceId}`).on("postgres_changes",
    { event: "UPDATE", schema: "public", table: "app_state", filter: `id=eq.${spaceId}` }, onChange,
  ).subscribe();
}
