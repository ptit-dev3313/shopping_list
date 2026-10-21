import { RenameTitle } from "../components/RenameTitle";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  IngredientDialog,
  emptyIngredientForm,
  formFromLine,
  type IngredientForm,
} from "../components/Dialogs";
import { AddRow, ListRow, SortableList } from "../components/List";
import { Empty, Page } from "../components/Page";
import { useApp } from "../context/AppContext";
import {
  createRecipe,
  removeRecipe,
  removeRecipeLine,
  renameRecipe,
  reorderRecipeLines,
  reorderRecipes,
  upsertRecipeLine,
} from "../lib/data";
import { formatLine, ingredientName, parseQuantity } from "../lib/format";

export function Recipes() {
  const { data, updateData, error } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  return (
    <Page title="Recettes" back="/">
      <AddRow
        placeholder="Nom de la recette"
        value={name}
        onChange={setName}
        onSubmit={() => {
          try {
            const result = createRecipe(data, name);
            updateData(() => result.data);
            setName("");
            navigate(`/recipes/${result.id}`);
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : "Erreur");
          }
        }}
      />
      {data.recipes.length === 0 ? <Empty text="Aucune recette pour le moment." /> : null}
      <SortableList onReorder={(from, to) => updateData((current) => reorderRecipes(current, from, to))}>
        {data.recipes.map((recipe) => (
          <ListRow
            key={recipe.id}
            label={recipe.name}
            len={data.recipes.length}
            onOpen={() => navigate(`/recipes/${recipe.id}`)}
            onDelete={() => {
              try {
                updateData((current) => removeRecipe(current, recipe.id));
              } catch (err: unknown) {
                error(err instanceof Error ? err.message : "Erreur");
              }
            }}
          />
        ))}
      </SortableList>
    </Page>
  );
}

export function EditRecipe() {
  const { id = "" } = useParams();
  const { data, updateData, error } = useApp();
  const recipe = data.recipes.find((item) => item.id === id);
  const [dialog, setDialog] = useState<IngredientForm | null>(null);

  if (!recipe) return <p className="empty">Recette introuvable</p>;

  return (
    <Page title="Recette" back="/recipes">
      <RenameTitle value={recipe.name} label="Nom de la recette" lowercase onSave={(name) => updateData((current) => renameRecipe(current, id, name))} />
      <button className="btn primary" type="button" onClick={() => setDialog(emptyIngredientForm())}>
        Ajouter un ingrédient
      </button>
      {recipe.ingredients.length === 0 ? (
        <Empty text="Ajoute les ingrédients de cette recette." />
      ) : null}
      <SortableList
        onReorder={(from, to) => updateData((current) => reorderRecipeLines(current, id, from, to))}
      >
        {recipe.ingredients.map((item) => (
          <ListRow
            key={item.id}
            label={formatLine(data, item)}
            len={recipe.ingredients.length}
            onOpen={() => setDialog(formFromLine(item, ingredientName(data, item.ingredientId)))}
            onDelete={() => updateData((current) => removeRecipeLine(current, id, item.id))}
          />
        ))}
      </SortableList>
      {dialog ? (
        <IngredientDialog
          form={dialog}
          names={data.ingredients.map((item) => item.name)}
          onClose={() => setDialog(null)}
          onSave={(saved) => {
            try {
              const quantity = parseQuantity(saved.quantity);
              updateData((current) =>
                upsertRecipeLine(current, id, saved.lineId, saved.name, quantity, saved.unit),
              );
              setDialog(null);
            } catch (err: unknown) {
              error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      ) : null}
    </Page>
  );
}
