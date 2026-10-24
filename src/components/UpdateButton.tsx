import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useUpdates } from "../context/UpdateContext";
import { useApp } from "../context/AppContext";
import { isAllowedDownload, releasePage } from "../lib/updates";
import { Overlay } from "./Page";

type DownloadProgress = { url: string; percent: number; phase: "downloading" | "verifying" };
const downloads = registerPlugin<{
  downloadUpdate(options: { url: string; sha256: string }): Promise<void>;
  installUpdate(): Promise<void>;
  addListener(event: "downloadProgress", callback: (progress: DownloadProgress) => void): Promise<PluginListenerHandle>;
}>("AppUpdates");

export function UpdateButton() {
  const { installed, release, checking, checked, error, check } = useUpdates();
  const { persist, preserveDraft } = useApp();
  const [open, setOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "downloading" | "verifying" | "installing">("idle");
  const [percent, setPercent] = useState(0);
  const [readyUrl, setReadyUrl] = useState("");
  const [installerOpened, setInstallerOpened] = useState(false);
  const [localBackup, setLocalBackup] = useState(false);
  const alive = useRef(true);
  const android = Capacitor.getPlatform() === "android";
  const busy = phase !== "idle";
  const ready = readyUrl === release?.apkUrl;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!android) return;
    let active = true;
    const listener = downloads.addListener("downloadProgress", (event) => {
      if (!active || event.url !== release?.apkUrl) return;
      setPercent(event.percent); setPhase(event.phase);
    });
    return () => { active = false; void listener.then((handle) => handle.remove()).catch(() => {}); };
  }, [android, release?.apkUrl]);

  const update = async () => {
    if (!release || busy) return;
    setDownloadError(null); setInstallerOpened(false); setLocalBackup(false); setPhase(ready ? "installing" : "downloading"); setPercent(0);
    try {
      if (!await persist()) {
        if (!preserveDraft?.()) throw new Error("Vos modifications n’ont pas pu être conservées. Réessayez avant la mise à jour.");
        setLocalBackup(true);
      }
      if (!isAllowedDownload(release.apkUrl) || !release.apkSha256) throw new Error("Les informations de vérification sont indisponibles. Appuyez sur « Vérifier à nouveau ».");
      if (!ready) {
        await downloads.downloadUpdate({ url: release.apkUrl, sha256: release.apkSha256 });
        if (!alive.current) return;
        setReadyUrl(release.apkUrl);
      }
      // The user may have kept editing while the download was running.
      if (!await persist()) {
        if (!preserveDraft?.()) throw new Error("Vos dernières modifications sont en attente et leur copie locale a échoué. Réessayez après leur enregistrement.");
        setLocalBackup(true);
      }
      if (!alive.current) return;
      setPhase("installing");
      await downloads.installUpdate();
      if (alive.current) setInstallerOpened(true);
    } catch (err) {
      if (alive.current) setDownloadError(err instanceof Error ? err.message : "Mise à jour impossible. Vérifiez votre connexion puis réessayez.");
    } finally { if (alive.current) setPhase("idle"); }
  };

  return <>
    <button className={release ? "update-button available" : "update-button"} type="button" aria-label={release ? `Mise à jour ${release.version} disponible` : "Mises à jour"} onClick={() => { setOpen(true); if (!busy) void check(); }}>
      <span aria-hidden="true">↥</span><span>{busy ? "Mise à jour…" : release ? "Màj disponible" : "Mises à jour"}</span>
    </button>
    {open ? <Overlay title="Mises à jour" onClose={() => setOpen(false)}>
      <p>Version installée : {installed}</p>
      {checking ? <p role="status">Vérification sur GitHub…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!checking && checked && !release && !error ? <p>Aucune version Android plus récente n’est disponible.</p> : null}
      {release ? <>
        <p>La version Android {release.version} est disponible.</p>
        <p className="hint">{android ? "La mise à jour se télécharge directement dans Courses. La première fois, Android vous demandera d’autoriser les installations depuis Courses ; revenez ensuite ici pour confirmer l’installation. Vos données et votre connexion sont conservées." : "Téléchargez l’APK sur votre téléphone Android puis ouvrez-la pour mettre à jour Courses."}</p>
        {android ? <>
          {phase === "downloading" ? <><progress className="update-progress" max={100} value={percent} aria-label="Téléchargement de la mise à jour" /><p role="status">Téléchargement… {percent} %</p></> : null}
          {phase === "verifying" ? <p role="status">Vérification du fichier et de sa signature…</p> : null}
          {phase === "installing" ? <p role="status">Ouverture de l’installation Android…</p> : null}
          {installerOpened ? <p role="status">Confirmez « Mettre à jour » dans Android. Si vous avez annulé, vous pouvez relancer l’installation.</p> : null}
          {localBackup ? <p role="status">Votre brouillon est conservé sur cet appareil et sera repris après la mise à jour. Installez par-dessus Courses sans la désinstaller.</p> : null}
          <button className="btn primary" disabled={busy || checking} onClick={() => void update()}>{busy ? "Mise à jour en cours…" : ready ? "Installer la mise à jour" : "Mettre à jour maintenant"}</button>
        </> : <a className="btn primary" href={release.apkUrl} target="_blank" rel="noopener noreferrer">Télécharger l’APK Android</a>}
      </> : null}
      {downloadError ? <p role="alert">{downloadError}</p> : null}
      <a href={release?.pageUrl ?? releasePage} target="_blank" rel="noopener noreferrer">Voir les versions sur GitHub</a>
      <button className="btn" disabled={checking || busy} onClick={() => void check()}>Vérifier à nouveau</button>
    </Overlay> : null}
  </>;
}
