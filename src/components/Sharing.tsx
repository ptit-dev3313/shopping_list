import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { acceptInvitation, createSpace, inviteToSpace, listInvitations, loadRemoteData, removeInvitation, renameSpace, saveRemoteData, type Invitation } from "../lib/supabase";
import { newId } from "../lib/types";

export function Sharing() {
  const { session, email, spaces, spaceId, data, error, info, refreshSpaces, persist, reload } = useApp();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [listId, setListId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const activeName = spaces.find((space) => space.id === spaceId)?.name ?? "";
  useEffect(() => setSpaceName(activeName), [activeName, spaceId]);
  const refresh = useCallback(async () => setInvitations(await listInvitations()), []);
  useEffect(() => { void refresh().catch((err: Error) => error(err.message)); }, [refresh, error, spaceId]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); await refresh(); await refreshSpaces(); }
    catch (err) { error(err instanceof Error ? err.message : "Opération impossible"); }
    finally { setBusy(false); }
  };
  const owned = spaces.find((space) => space.id === spaceId)?.owner_id === session?.user.id;
  return <section className="stack">
    <h2>Espaces et partage</h2>
    {owned && spaceId ? <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      if (!await persist()) return;
      await renameSpace(spaceId, spaceName); await reload(); info("Espace renommé");
    }); }}>
      <label className="field">Nom de l’espace actif<input autoCapitalize="none" value={spaceName} onChange={(event) => setSpaceName(event.target.value.toLocaleLowerCase("fr"))} required maxLength={100} /></label>
      <button className="btn" type="submit" disabled={busy || spaceName === activeName}>Renommer cet espace</button>
    </form> : null}
    <p className="hint">Chaque compte possède un espace privé. Les invités peuvent voir et modifier tout le contenu de l’espace partagé. Pour partager seulement certaines listes, créez un espace séparé et copiez-y les listes choisies.</p>
    <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createSpace(name); setName(""); info("Espace créé. Sélectionnez-le dans le menu en haut."); }); }}>
      <label className="field">Nouvel espace<input autoCapitalize="none" value={name} onChange={(event) => setName(event.target.value.toLocaleLowerCase("fr"))} required maxLength={100} /></label>
      <button className="btn" disabled={busy || !name.trim()}>Créer un espace</button>
    </form>
    {owned && spaceId && !spaceId.startsWith("personal:") ? <>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(async () => {
        if (inviteEmail.trim().toLowerCase() === email?.toLowerCase()) throw new Error("Vous avez déjà accès à cet espace.");
        await inviteToSpace(spaceId, inviteEmail); setInviteEmail(""); info("Invitation créée. La personne la trouvera dans ses paramètres après connexion. Aucun e-mail n’est envoyé.");
      }); }}>
        <label className="field">Inviter dans l’espace actif<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label>
        <button className="btn" disabled={busy}>Inviter à voir et modifier cet espace</button>
      </form>
      {invitations.filter((invite) => invite.space_id === spaceId).map((invite) => <div key={invite.email}>
        <p>{invite.email} — {invite.user_id ? "membre" : "en attente"}</p>
        <button className="btn" disabled={busy} onClick={() => void run(async () => { await removeInvitation(spaceId, invite.email); info("Accès retiré"); })}>Retirer l’accès</button>
      </div>)}
    </> : null}
    {invitations.filter((invite) => invite.email === email?.toLowerCase() && !invite.user_id).map((invite) => <div key={invite.space_id}>
      <p>Invitation à un espace partagé ({invite.space_id})</p>
      <button className="btn" disabled={busy} onClick={() => void run(async () => { await acceptInvitation(invite.space_id, invite.email, session!.user.id); info("Invitation acceptée. L’espace est disponible dans le menu."); })}>Accepter</button>
      <button className="btn ghost" disabled={busy} onClick={() => void run(() => removeInvitation(invite.space_id, invite.email))}>Refuser</button>
    </div>)}
    {!owned && spaceId && email ? <button className="btn" disabled={busy} onClick={() => void run(() => removeInvitation(spaceId, email.toLowerCase()))}>Quitter cet espace</button> : null}
    <button className="btn ghost" disabled={busy} onClick={() => void run(async () => {})}>Actualiser les invitations</button>
    {data.lists.length > 0 ? <form className="stack" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const list = data.lists.find((item) => item.id === listId);
      if (!list || !targetId || targetId === spaceId) throw new Error("Choisissez une liste et un autre espace.");
      const remote = await loadRemoteData(targetId);
      const ingredientIds = new Set(list.items.map((item) => item.line.ingredientId));
      const mapping = new Map<string, string>();
      const ingredients = [...remote.payload.ingredients];
      for (const id of ingredientIds) {
        const ingredient = data.ingredients.find((item) => item.id === id);
        if (!ingredient) throw new Error("Un ingrédient de cette liste est introuvable.");
        const existing = ingredients.find((item) => item.name.toLowerCase() === ingredient.name.toLowerCase());
        const mappedId = existing?.id ?? newId(); mapping.set(id, mappedId);
        if (!existing) ingredients.push({ id: mappedId, name: ingredient.name });
      }
      const copy = { ...list, id: newId(), items: list.items.map((item) => ({ ...item, id: newId(), line: { ...item.line, id: newId(), ingredientId: mapping.get(item.line.ingredientId)! } })) };
      await saveRemoteData(targetId, { ...remote.payload, ingredients, lists: [copy, ...remote.payload.lists] }, remote.revision);
      info("Copie créée dans l’autre espace. Les futures modifications des deux listes sont indépendantes.");
    }); }}>
      <h3>Copier une liste choisie</h3>
      <label className="field">Liste à copier<select value={listId} onChange={(event) => setListId(event.target.value)} required><option value="">Choisir…</option>{data.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
      <label className="field">Espace de destination<select value={targetId} onChange={(event) => setTargetId(event.target.value)} required><option value="">Choisir…</option>{spaces.filter((space) => space.id !== spaceId).map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
      <button className="btn" disabled={busy}>Copier uniquement cette liste et ses ingrédients</button>
    </form> : null}
  </section>;
}
