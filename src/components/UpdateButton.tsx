import { useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useUpdates } from "../context/UpdateContext";
import { useApp } from "../context/AppContext";
import { isAllowedDownload, releasePage } from "../lib/updates";
import { Overlay } from "./Page";

const downloads = registerPlugin<{ openDownload(options: { url: string }): Promise<void> }>("AppUpdates");

export function UpdateButton() {
  const { installed, release, checking, checked, error, check } = useUpdates();
  const { persist } = useApp();
  const [open, setOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const android = Capacitor.getPlatform() === "android";
  return <>
    <button className={release ? "update-button available" : "update-button"} type="button" aria-label={release ? `Mise à jour ${release.version} disponible` : "Mises à jour"} onClick={() => { setOpen(true); void check(); }}>
      <span aria-hidden="true">↥</span><span>{release ? "Màj disponible" : "Mises à jour"}</span>
    </button>
    {open ? <Overlay title="Mises à jour" onClose={() => setOpen(false)}>
      <p>Version installée : {installed}</p>
      {checking ? <p role="status">Vérification sur GitHub…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!checking && checked && !release && !error ? <p>Aucune version Android plus récente n’est disponible.</p> : null}
      {release ? <>
        <p>La version Android {release.version} est disponible.</p>
        <p className="hint">Téléchargez l’APK, puis ouvrez le fichier téléchargé. Android vous demandera de confirmer la mise à jour. Vos données et votre connexion sont conservées si vous installez par-dessus l’application actuelle.</p>
        {android ? <button className="btn primary" onClick={async () => {
          setDownloadError(null);
          if (!await persist()) { setDownloadError("Sauvegarde impossible. Réessayez avant de télécharger la mise à jour."); return; }
          try {
            if (!isAllowedDownload(release.apkUrl)) throw new Error("Lien de téléchargement invalide.");
            await downloads.openDownload({ url: release.apkUrl });
          } catch { setDownloadError("Impossible d’ouvrir le téléchargement. Utilisez la page GitHub ci-dessous."); }
        }}>Télécharger l’APK</button> : <a className="btn primary" href={release.apkUrl} target="_blank" rel="noopener noreferrer">Télécharger l’APK Android</a>}
      </> : null}
      {downloadError ? <p role="alert">{downloadError}</p> : null}
      <a href={release?.pageUrl ?? releasePage} target="_blank" rel="noopener noreferrer">Voir les versions sur GitHub</a>
      <button className="btn" disabled={checking} onClick={() => void check()}>Vérifier à nouveau</button>
    </Overlay> : null}
  </>;
}
