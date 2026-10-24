import { useState } from "react";
import { TextDialog } from "../components/Dialogs";
import { ListRow, SortableList } from "../components/List";
import { Empty, Page } from "../components/Page";
import { Overlay } from "../components/Page";
import { useApp } from "../context/AppContext";
import {
  addIngredient,
  cleanUnusedIngredients,
  deleteIngredient,
  renameIngredient,
  reorderIngredients,
  mergeIngredients,
} from "../lib/data";

export function Ingredients() {
  const { data, updateData, error } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [spelling, setSpelling] = useState("");

  return (
    <Page title="Ingrédients" back="/">
      <div className="actions">
        <button className="btn" type="button" disabled={data.ingredients.length < 2} onClick={() => setMergeOpen(true)}>Fusionner deux ingrédients</button>
        <button className="btn primary" type="button" onClick={() => setAddOpen(true)}>
          Ajouter
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => updateData(cleanUnusedIngredients)}
        >
          Nettoyer
        </button>
      </div>
      {data.ingredients.length === 0 ? (
        <Empty text="Le catalogue se remplit en ajoutant des recettes." />
      ) : null}
      <SortableList onReorder={(from, to) => updateData((current) => reorderIngredients(current, from, to))}>
        {data.ingredients.map((item) => (
          <ListRow
            key={item.id}
            label={item.name}
            len={data.ingredients.length}
            onOpen={() => setRenameId(item.id)}
            onDelete={() => {
              try {
                updateData((current) => deleteIngredient(current, item.id));
              } catch (err: unknown) {
                error(err instanceof Error ? err.message : "Erreur");
              }
            }}
          />
        ))}
      </SortableList>
      {mergeOpen ? <Overlay title="Fusionner deux ingrédients" onClose={() => setMergeOpen(false)}>
        <p className="hint">Toutes les recettes, les achats et les listes de cet espace utiliseront le même ingrédient. Les quantités et les cases cochées sont conservées.</p>
        <label className="field">Ingrédient à fusionner<select value={sourceId} onChange={(event) => setSourceId(event.target.value)} required><option value="">Choisir…</option>{data.ingredients.filter((item) => item.id !== targetId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="field">Fusionner avec<select value={targetId} onChange={(event) => { setTargetId(event.target.value); setSpelling(data.ingredients.find((item) => item.id === event.target.value)?.name.toLowerCase() ?? ""); }} required><option value="">Choisir…</option>{data.ingredients.filter((item) => item.id !== sourceId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="field">Orthographe à conserver (minuscules)<input autoCapitalize="none" value={spelling} onChange={(event) => setSpelling(event.target.value.toLocaleLowerCase("fr"))} /></label>
        <div className="actions">{[sourceId, targetId].filter(Boolean).map((id) => <button className="btn ghost" key={id} onClick={() => setSpelling(data.ingredients.find((item) => item.id === id)!.name.toLowerCase())} type="button">{data.ingredients.find((item) => item.id === id)?.name.toLowerCase()}</button>)}</div>
        <button className="btn primary" type="button" disabled={!sourceId || !targetId || !spelling.trim()} onClick={() => {
          try { updateData((current) => mergeIngredients(current, sourceId, targetId, spelling)); setMergeOpen(false); setSourceId(""); setTargetId(""); }
          catch (err) { error(err instanceof Error ? err.message : "Fusion impossible"); }
        }}>Fusionner et mettre à jour les références</button>
      </Overlay> : null}
      {addOpen ? (
        <TextDialog
          title="Nouvel ingrédient"
          action="Ajouter"
          value=""
          onClose={() => setAddOpen(false)}
          onSave={(name) => {
            try {
              if (data.ingredients.some((item) => item.name.toLowerCase() === name.trim().toLowerCase())) {
                throw new Error("Ingrédient déjà existant!");
              }
              updateData((current) => addIngredient(current, name));
              setAddOpen(false);
            } catch (err: unknown) {
              error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      ) : null}
      {renameId ? (
        <TextDialog
          title="Renommer"
          action="Enregistrer"
          value={data.ingredients.find((item) => item.id === renameId)?.name ?? ""}
          onClose={() => setRenameId(null)}
          onSave={(name) => {
            try {
              updateData((current) => renameIngredient(current, renameId, name));
              setRenameId(null);
            } catch (err: unknown) {
              error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      ) : null}
    </Page>
  );
}
