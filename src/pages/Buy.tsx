import { RenameTitle } from "../components/RenameTitle";
import { useNavigate, useParams } from "react-router";
import { ListRow, SortableList } from "../components/List";
import { Empty, Page } from "../components/Page";
import { useApp } from "../context/AppContext";
import { renameList, removeList, reorderBuyItems, reorderLists, toggleBuyItem } from "../lib/data";
import { formatLine } from "../lib/format";

export function BuyLists() {
  const { data, updateData } = useApp();
  const navigate = useNavigate();

  return (
    <Page title="À acheter" back="/">
      {data.lists.length === 0 ? <Empty text="Génère une liste depuis Achats." /> : null}
      <SortableList onReorder={(from, to) => updateData((current) => reorderLists(current, from, to))}>
        {data.lists.map((list) => (
          <ListRow
            key={list.id}
            label={list.name}
            len={data.lists.length}
            onOpen={() => navigate(`/buy-lists/${list.id}`)}
            onDelete={() => updateData((current) => removeList(current, list.id))}
          />
        ))}
      </SortableList>
    </Page>
  );
}

export function Buy() {
  const { id = "" } = useParams();
  const { data, updateData } = useApp();
  const list = data.lists.find((item) => item.id === id);
  if (!list) return <p className="empty">Liste introuvable</p>;
  const remaining = list.items.filter((item) => !item.checked).length;

  return (
    <Page title="Courses" back="/buy-lists">
      <RenameTitle value={list.name} label="Nom de la liste de courses" onSave={(name) => updateData((current) => renameList(current, id, name))} />
      <p className="hint">{remaining} article(s) restant(s)</p>
      {list.items.length === 0 ? <Empty text="Rien à acheter." /> : null}
      <SortableList
        onReorder={(from, to) => updateData((current) => reorderBuyItems(current, id, from, to))}
      >
        {list.items.map((item) => (
          <li key={item.id} className={item.checked ? "card-row checked" : "card-row"}>
            {list.items.length > 1 ? (
              <span className="drag-handle" title="Glisser pour réordonner">
                ⋮⋮
              </span>
            ) : null}
            <label className="check grow">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) =>
                  updateData((current) => toggleBuyItem(current, id, item.id, event.target.checked))
                }
              />
              <span>{formatLine(data, item.line)}</span>
            </label>
          </li>
        ))}
      </SortableList>
    </Page>
  );
}
