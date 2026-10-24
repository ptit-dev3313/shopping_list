import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";

export function RenameTitle({ value, label, onSave }: {
  value: string; label: string; onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const { error, info } = useApp();
  useEffect(() => setDraft(value), [value]);
  return <form className="rename-title" onSubmit={(event) => {
    event.preventDefault();
    try { onSave(draft); info("Nom modifié"); } catch (err) { error(err instanceof Error ? err.message : "Nom invalide"); }
  }}>
    <label className="field">{label}<input className="title-input" value={draft} required autoCapitalize="none" onChange={(event) => setDraft(event.target.value.toLocaleLowerCase("fr"))} /></label>
    <button className="btn" type="submit" disabled={draft === value}>Renommer</button>
  </form>;
}
