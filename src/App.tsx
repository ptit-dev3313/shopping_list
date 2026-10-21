import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppProvider, useApp } from "./context/AppContext";
import { Buy, BuyLists } from "./pages/Buy";
import { Home } from "./pages/Home";
import { Ingredients } from "./pages/Ingredients";
import { Login } from "./pages/Login";
import { EditRecipe, Recipes } from "./pages/Recipes";
import { Settings } from "./pages/Settings";
import { EditShopping, Shoppings } from "./pages/Shoppings";
import { UpdateProvider } from "./context/UpdateContext";

function Shell() {
  const { session, loading, saveStatus, saveMessage, persist, toast, setToast, spaceId, spaces, switchSpace } = useApp();

  if (!session) return <Login />;

  return (
    <div className="app">
      <label className="field space-picker">
        Espace actif
        <select value={spaceId ?? ""} disabled={loading} onChange={(event) => void switchSpace(event.target.value)}>
          {!spaceId ? <option value="">Chargement…</option> : null}
          {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}{space.owner_id === session.user.id ? " (à moi)" : " (partagé)"}</option>)}
        </select>
      </label>
      {!loading ? <div className={`autosave-status ${saveStatus}`} role="status">
        <span>{saveStatus === "saved" ? "✓ Enregistré automatiquement" : saveStatus === "saving" ? "Enregistrement…" : saveStatus === "pending" ? "Modifications en attente…" : "Enregistrement en attente — vos modifications restent sur cet appareil."}</span>
        {saveStatus === "error" ? <><small>{saveMessage}</small><button className="btn ghost" onClick={() => void persist()}>Réessayer</button></> : null}
      </div> : null}
      <Routes key={`${session.user.id}:${spaceId}`}>
        <Route path="/" element={<Home />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<EditRecipe />} />
        <Route path="/shoppings" element={<Shoppings />} />
        <Route path="/shoppings/:id" element={<EditShopping />} />
        <Route path="/buy-lists" element={<BuyLists />} />
        <Route path="/buy-lists/:id" element={<Buy />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {loading ? (
        <div className="overlay">
          <div className="sheet">
            <p>Chargement…</p>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className={toast.kind === "error" ? "toast error" : "toast"} onClick={() => setToast(null)}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <UpdateProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
      </UpdateProvider>
    </AppProvider>
  );
}
