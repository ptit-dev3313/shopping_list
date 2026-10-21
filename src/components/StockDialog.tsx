import { useState } from "react";
import { Overlay } from "./Page";
import { useApp } from "../context/AppContext";
import { setStockQuantity, stockRows, type StockRow } from "../lib/calc";
import { formatQuantity, ingredientName, parseQuantity } from "../lib/format";

export function StockDialog({ shoppingId, onClose }: { shoppingId: string; onClose: () => void }) {
  const { data, updateData, error } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const shopping = data.shoppings.find((item) => item.id === shoppingId);
  if (!shopping) return null;
  const rows = stockRows(data, shopping);
  const save = (row: StockRow, amount: number) => {
    updateData((current) => setStockQuantity(current, shoppingId, row.ingredientId, row.unit, amount));
    setSelected(null);
  };
  return <Overlay title="Déjà à la maison" onClose={onClose} dismissOnBackdrop={false}>
    <p className="hint">Choisissez les ingrédients disponibles, puis indiquez la quantité. La partie orange est déjà à la maison. Fermez cette fenêtre quand vous avez terminé.</p>
    {rows.length === 0 ? <p className="empty">Ajoutez une recette ou un ingrédient à cette liste.</p> : null}
    <ul className="list stock-list">
      {rows.map((row) => <li key={row.key} className="stock-row">
        <button className="stock-pick" type="button" aria-expanded={selected === row.key} onClick={() => {
          setSelected(row.key); setQuantity(formatQuantity(row.covered || row.total));
        }}>
          <strong>{ingredientName(data, row.ingredientId)}</strong>
          <span className="stock-quantities">
            {row.covered > 0 ? <span className="stock-covered">{formatQuantity(row.covered)} {row.unit} déjà à la maison</span> : null}
            <span>{formatQuantity(row.remaining)} {row.unit} à acheter</span>
          </span>
          <span className="stock-meter" aria-hidden="true"><span style={{ width: `${row.covered / row.total * 100}%` }} /></span>
        </button>
        {selected === row.key ? <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          try { save(row, parseQuantity(quantity)); } catch (err) { error(err instanceof Error ? err.message : "Quantité invalide"); }
        }}>
          <label className="field">Quantité disponible ({row.unit})<input aria-label={`Quantité disponible de ${ingredientName(data, row.ingredientId)}`} value={quantity} inputMode="decimal" required onChange={(event) => setQuantity(event.target.value)} autoFocus /></label>
          <button className="btn primary" type="submit">Confirmer la quantité</button>
          {row.covered > 0 ? <button className="btn ghost" type="button" onClick={() => save(row, 0)}>Retirer de « déjà à la maison »</button> : null}
        </form> : null}
      </li>)}
    </ul>
  </Overlay>;
}
