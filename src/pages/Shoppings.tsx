import { RenameTitle } from "../components/RenameTitle";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  IngredientDialog,
  RecipePickDialog,
  emptyIngredientForm,
  formFromLine,
  type IngredientForm,
  type RecipePickForm,
} from "../components/Dialogs";
import { AddRow, ListRow, SortableList } from "../components/List";
import { Empty, Page } from "../components/Page";
import { useApp } from "../context/AppContext";
import { StockDialog } from "../components/StockDialog";
import { plannedList } from "../lib/calc";
import {
  addBuyList,
  createShopping,
  removeShopping,
  removeShoppingLine,
  removeShoppingRecipe,
  renameShopping,
  reorderShoppingLines,
  reorderShoppings,
  scaledRecipeIngredients,
  upsertShoppingLine,
  upsertShoppingRecipe,
} from "../lib/data";
import { formatLine, formatQuantity, formatRecipeLine, ingredientName, parseQuantity, recipeName } from "../lib/format";
import type { LineItem, RecipeLine } from "../lib/types";

export function Shoppings() {
  const { data, updateData, error, info } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  return (
    <Page title="Achats" back="/">
      <AddRow
        placeholder="Nom de la liste"
        value={name}
        onChange={setName}
        onSubmit={() => {
          try {
            const result = createShopping(data, name);
            updateData(() => result.data);
            setName("");
            navigate(`/shoppings/${result.id}`);
          } catch (err: unknown) {
            error(err instanceof Error ? err.message : "Erreur");
          }
        }}
      />
      {data.shoppings.length === 0 ? <Empty text="Crée une liste, puis génère les courses." /> : null}
      <SortableList onReorder={(from, to) => updateData((current) => reorderShoppings(current, from, to))}>
        {data.shoppings.map((shopping) => (
          <ListRow
            key={shopping.id}
            label={shopping.name}
            len={data.shoppings.length}
            onOpen={() => navigate(`/shoppings/${shopping.id}`)}
            extraLabel="🛒"
            onExtra={() => {
              updateData((current) => addBuyList(current, plannedList(current, shopping)));
              info("Liste à acheter créée");
              navigate("/buy-lists");
            }}
            onDelete={() => updateData((current) => removeShopping(current, shopping.id))}
          />
        ))}
      </SortableList>
    </Page>
  );
}

export function EditShopping() {
  const { id = "" } = useParams();
  const { data, updateData, error } = useApp();
  const shopping = data.shoppings.find((item) => item.id === id);
  const [ingredientDialog, setIngredientDialog] = useState<{
    slot: "extras" | "already";
    form: IngredientForm;
  } | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [recipeDialog, setRecipeDialog] = useState<RecipePickForm | null>(null);

  if (!shopping) return <p className="empty">Liste introuvable</p>;

  return (
    <Page title="Liste d'achats" back="/shoppings">
      <RenameTitle value={shopping.name} label="Nom de la liste d’achats" onSave={(name) => updateData((current) => renameShopping(current, id, name))} />
      <div className="actions">
        <button
          className="btn"
          type="button"
          onClick={() => setIngredientDialog({ slot: "extras", form: emptyIngredientForm() })}
        >
          Ingrédient
        </button>
        <button className="btn" type="button" onClick={() => setRecipeDialog({ name: "", quantity: "1" })}>
          Recette
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setStockOpen(true)}
        >
          Déjà à la maison
        </button>
      </div>

      <h2 className="section-title">À acheter en plus</h2>
      <LineList
        items={shopping.extras}
        onReorder={(from, to) =>
          updateData((current) => reorderShoppingLines(current, id, "extras", from, to))
        }
        onEdit={(item) =>
          setIngredientDialog({
            slot: "extras",
            form: formFromLine(item, ingredientName(data, item.ingredientId)),
          })
        }
        onDelete={(lineId) =>
          updateData((current) => removeShoppingLine(current, id, "extras", lineId))
        }
      />

      <h2 className="section-title">Recettes</h2>
      <SortableList
        onReorder={(from, to) =>
          updateData((current) => reorderShoppingLines(current, id, "recipes", from, to))
        }
      >
        {shopping.recipes.map((item) => (
          <ShoppingRecipeRow
            key={item.id}
            item={item}
            len={shopping.recipes.length}
            onOpen={() =>
              setRecipeDialog({
                lineId: item.id,
                name: recipeName(data, item.recipeId),
                quantity: formatQuantity(item.quantity),
              })
            }
            onDelete={() => updateData((current) => removeShoppingRecipe(current, id, item.id))}
          />
        ))}
      </SortableList>

      <h2 className="section-title">Déjà disponible</h2>
      <LineList
        items={shopping.already}
        onReorder={(from, to) =>
          updateData((current) => reorderShoppingLines(current, id, "already", from, to))
        }
        onEdit={(item) =>
          setIngredientDialog({
            slot: "already",
            form: formFromLine(item, ingredientName(data, item.ingredientId)),
          })
        }
        onDelete={(lineId) =>
          updateData((current) => removeShoppingLine(current, id, "already", lineId))
        }
      />

      {stockOpen ? <StockDialog shoppingId={id} onClose={() => setStockOpen(false)} /> : null}
      {ingredientDialog ? (
        <IngredientDialog
          form={ingredientDialog.form}
          names={data.ingredients.map((item) => item.name)}
          onClose={() => setIngredientDialog(null)}
          onSave={(saved) => {
            try {
              const quantity = parseQuantity(saved.quantity);
              updateData((current) =>
                upsertShoppingLine(
                  current,
                  id,
                  ingredientDialog.slot,
                  saved.lineId,
                  saved.name,
                  quantity,
                  saved.unit,
                ),
              );
              setIngredientDialog(null);
            } catch (err: unknown) {
              error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      ) : null}
      {recipeDialog ? (
        <RecipePickDialog
          form={recipeDialog}
          data={data}
          onClose={() => setRecipeDialog(null)}
          onSave={(saved) => {
            try {
              const quantity = parseQuantity(saved.quantity);
              updateData((current) =>
                upsertShoppingRecipe(current, id, saved.lineId, saved.name, quantity),
              );
              setRecipeDialog(null);
            } catch (err: unknown) {
              error(err instanceof Error ? err.message : "Erreur");
            }
          }}
        />
      ) : null}
    </Page>
  );
}

function ShoppingRecipeRow({
  item,
  len,
  onOpen,
  onDelete,
}: {
  item: RecipeLine;
  len: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { data } = useApp();
  const [showIngredients, setShowIngredients] = useState(true);
  const recipe = data.recipes.find((entry) => entry.id === item.recipeId);
  const ingredients = recipe ? scaledRecipeIngredients(recipe, item.quantity) : [];

  return (
    <li className="card-row recipe-row">
      <div className="recipe-row-head">
        {len > 1 ? (
          <span className="drag-handle" title="Glisser pour réordonner">
            ⋮⋮
          </span>
        ) : null}
        <span className="grow">{formatRecipeLine(data, item)}</span>
        <button
          className="icon-btn"
          type="button"
          aria-expanded={showIngredients}
          title={showIngredients ? "Masquer les ingrédients" : "Afficher les ingrédients"}
          onClick={() => setShowIngredients((open) => !open)}
        >
          {showIngredients ? "▾" : "▸"}
        </button>
        <button className="icon-btn" type="button" onClick={onOpen}>
          ✎
        </button>
        <button className="icon-btn danger" type="button" onClick={onDelete}>
          ✕
        </button>
      </div>
      {showIngredients ? (
        ingredients.length === 0 ? (
          <p className="recipe-ingredients empty-inline">Aucun ingrédient dans cette recette.</p>
        ) : (
          <ul className="recipe-ingredients">
            {ingredients.map((line) => (
              <li key={line.id}>{formatLine(data, line)}</li>
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

function LineList({
  items,
  onReorder,
  onEdit,
  onDelete,
}: {
  items: LineItem[];
  onReorder: (from: number, to: number) => void;
  onEdit: (item: LineItem) => void;
  onDelete: (lineId: string) => void;
}) {
  const { data } = useApp();
  return (
    <SortableList onReorder={onReorder}>
      {items.map((item) => (
        <ListRow
          key={item.id}
          label={formatLine(data, item)}
          len={items.length}
          onOpen={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </SortableList>
  );
}
