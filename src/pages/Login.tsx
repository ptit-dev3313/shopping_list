import { useState, type FormEvent } from "react";
import { signInWithPassword, signUpWithPassword } from "../lib/supabase";
import { UpdateButton } from "../components/UpdateButton";

type Mode = "login" | "signup";

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetAlerts() {
    setError(null);
    setMessage(null);
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    resetAlerts();
    try {
      await signInWithPassword(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  async function onSignup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    resetAlerts();
    try {
      if (password !== confirm) throw new Error("Les mots de passe ne correspondent pas.");
      const result = await signUpWithPassword(email, password);
      if (result === "exists") {
        setMode("login");
        setError("Ce compte existe déjà. Connecte-toi.");
      } else {
        setMessage("Compte créé. Ouvre l’e-mail et clique sur le lien pour confirmer, puis reconnecte-toi.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Courses</h1>
        <UpdateButton />
      </header>
      <main className="page">
        <p className="lead">Vos courses, en privé ou à plusieurs</p>
        <p className="hint">Créez votre compte pour obtenir un espace privé. Partagez un espace sur invitation.</p>
        <div className="tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            type="button"
            onClick={() => {
              setMode("login");
              resetAlerts();
            }}
          >
            Connexion
          </button>
          <button
            className={mode === "signup" ? "tab active" : "tab"}
            type="button"
            onClick={() => {
              setMode("signup");
              resetAlerts();
            }}
          >
            Créer un compte
          </button>
        </div>

        {mode === "login" ? (
          <form className="stack" onSubmit={onLogin}>
            <EmailField value={email} onChange={setEmail} />
            <label className="field">
              Mot de passe
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <Alerts message={message} error={error} />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={onSignup}>
            <EmailField value={email} onChange={setEmail} />
            <label className="field">
              Mot de passe
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="field">
              Confirmer le mot de passe
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <Alerts message={message} error={error} />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Création…" : "Créer le compte"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      E-mail
      <input
        type="email"
        autoComplete="email"
        value={value}
        placeholder="toi@email.com"
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function Alerts({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message ? <p className="hint">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </>
  );
}
