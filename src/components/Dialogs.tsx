import { useMemo, useState } from "react";
import { Overlay } from "./Page";
import { IngredientNameInput } from "./IngredientNameInput";
import { formatLine, formatQuantity, parseQuantity } from "../lib/format";
import { scaledRecipeIngredients } from "../lib/data";
import type { AppData, LineItem, Recipe, Unit } from "../lib/types";
import { UNITS, parseUnit } from "../lib/types";

export type IngredientForm = {
  lineId?: string;
  name: string;
  quantity: string;
  unit: Unit;
};

export function emptyIngredientForm(): IngredientForm {
  return { name: "", quantity: "1", unit: "-" };
}

export function formFromLine(item: LineItem, name: string): IngredientForm {
  return {
    lineId: item.id,
    name,
    quantity: formatQuantity(item.quantity),
    unit: item.unit,
  };
}

export function IngredientDialog({
  form,
  names,
  onClose,
  onSave,
}: {
  form: IngredientForm;
  names: string[];
  onClose: () => void;
  onSave: (form: IngredientForm) => void;
}) {
  const [name, setName] = useState(form.name);
  const [quantity, setQuantity] = useState(form.quantity);
  const [unit, setUnit] = useState(form.unit);
  const editing = Boolean(form.lineId);

  return (
    <Overlay title={editing ? "Modifier l'ingrédient" : "Ajouter un ingrédient"} onClose={onClose}>
      <IngredientNameInput value={name} names={names} onChange={setName} />
      <div className="split">
        <label className="field">
          Quantité
          <input
            value={quantity}
            inputMode="decimal"
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="field">
          Unité
          <select value={unit} onChange={(event) => setUnit(parseUnit(event.target.value))}>
            {UNITS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn primary"
        type="button"
        onClick={() => onSave({ lineId: form.lineId, name, quantity, unit })}
      >
        {editing ? "Enregistrer" : "Ajouter"}
      </button>
    </Overlay>
  );
}

export type RecipePickForm = {
  lineId?: string;
  name: string;
  quantity: string;
};

export function RecipePickDialog({
  form,
  data,
  onClose,
  onSave,
}: {
  form: RecipePickForm;
  data: AppData;
  onClose: () => void;
  onSave: (form: RecipePickForm) => void;
}) {
  const [name, setName] = useState(form.name);
  const [quantity, setQuantity] = useState(form.quantity);
  const editing = Boolean(form.lineId);
  const names = [...data.recipes.map((recipe) => recipe.name)].sort((a, b) => a.localeCompare(b, "fr"));
  const recipe: Recipe | undefined = data.recipes.find((item) => item.name === name);
  const preview = useMemo(() => {
    if (!recipe) return [];
    try {
      return scaledRecipeIngredients(recipe, parseQuantity(quantity || "1"));
    } catch {
      return scaledRecipeIngredients(recipe, 1);
    }
  }, [recipe, quantity]);

  return (
    <Overlay title={editing ? "Modifier la recette" : "Ajouter une recette"} onClose={onClose}>
      <label className="field">
        Recette
        <select value={name} onChange={(event) => setName(event.target.value)}>
          <option value="">Choisir…</option>
          {names.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Portions / quantité
        <input
          value={quantity}
          inputMode="decimal"
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>
      {recipe ? (
        <div className="preview">
          <p className="section-title">Ingrédients</p>
          {preview.length === 0 ? (
            <p className="hint">Aucun ingrédient dans cette recette.</p>
          ) : (
            <ul className="preview-list">
              {preview.map((item) => (
                <li key={item.id}>{formatLine(data, item)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <button
        className="btn primary"
        type="button"
        onClick={() => onSave({ lineId: form.lineId, name, quantity })}
      >
        {editing ? "Enregistrer" : "Ajouter"}
      </button>
    </Overlay>
  );
}

export function TextDialog({
  title,
  action,
  value,
  onClose,
  onSave,
}: {
  title: string;
  action: string;
  value: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Overlay title={title} onClose={onClose}>
      <input autoCapitalize="none" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button className="btn primary" type="button" onClick={() => onSave(draft)}>
        {action}
      </button>
    </Overlay>
  );
}
