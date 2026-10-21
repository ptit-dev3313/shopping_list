import { useNavigate } from "react-router";
import { Page } from "../components/Page";
import { useApp } from "../context/AppContext";

export function Home() {
  const navigate = useNavigate();
  const { persist, email } = useApp();
  const isElectron = Boolean(window.electronAPI?.isElectron);

  return (
    <Page title="Courses">
      <p className="lead">Vos courses, en privé ou à plusieurs</p>
      {email ? <p className="hint">Connecté : {email}</p> : null}
      <div className="tiles">
        <Tile emoji="🥣" title="Recettes" hint="Plats et ingrédients" to="/recipes" />
        <Tile emoji="🧺" title="Achats" hint="Préparer une tournée" to="/shoppings" />
        <Tile emoji="✓" title="À acheter" hint="Listes cochables" to="/buy-lists" />
        <Tile emoji="🍋" title="Ingrédients" hint="Catalogue commun" to="/ingredients" />
      </div>
      <button className="btn ghost" type="button" onClick={() => navigate("/settings")}>
        Paramètres
      </button>
      {isElectron ? (
        <button
          className="btn danger-text"
          type="button"
          onClick={() => {
            void persist(false).then((saved) => { if (saved) window.electronAPI?.quit(); });
          }}
        >
          Quitter
        </button>
      ) : null}
    </Page>
  );
}

function Tile({
  emoji,
  title,
  hint,
  to,
}: {
  emoji: string;
  title: string;
  hint: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button className="tile" type="button" onClick={() => navigate(to)}>
      <span className="tile-emoji">{emoji}</span>
      <span className="tile-title">{title}</span>
      <span className="tile-hint">{hint}</span>
    </button>
  );
}
