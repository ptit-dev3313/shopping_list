import { useState } from "react";
import { Sharing } from "../components/Sharing";
import { Page } from "../components/Page";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";

export function Settings() {
  const { email, persist, reload, resetLocal, info, error } = useApp();
  const [password, setPassword] = useState("");

  return (
    <Page title="Paramètres" back="/">
      <p className="hint">Compte : {email ?? "non connecté"}</p>
      <p className="hint">
        Vos données restent dans l’espace actif. Le partage se gère ci-dessous.
      </p>
      <Sharing />
      <label className="field">
        Nouveau mot de passe
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        className="btn"
        type="button"
        onClick={async () => {
          if (password.length < 6) {
            error("Le mot de passe doit faire au moins 6 caractères.");
            return;
          }
          const { error: updateError } = await supabase.auth.updateUser({ password });
          if (updateError) error(updateError.message);
          else {
            setPassword("");
            info("Mot de passe enregistré");
          }
        }}
      >
        Enregistrer le mot de passe
      </button>
      <button
        className="btn"
        type="button"
        onClick={async () => {
          try {
            if (!window.confirm("Recharger et abandonner les modifications non sauvegardées de cet espace ?")) return;
            await reload();
            info("Données rechargées");
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : "Rechargement impossible");
          }
        }}
      >
        Recharger depuis le cloud
      </button>
      <button
        className="btn danger-text"
        type="button"
        onClick={async () => {
          if (!window.confirm("Effacer tout le contenu de l’espace actif pour tous ses membres ?")) return;
          resetLocal();
          try {
            if (await persist()) info("Données réinitialisées");
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : "Reset impossible");
          }
        }}
      >
        Effacer le contenu de cet espace
      </button>
      <button
        className="btn ghost"
        type="button"
        onClick={async () => {
          if (await persist()) await supabase.auth.signOut();
        }}
      >
        Se déconnecter
      </button>
    </Page>
  );
}
