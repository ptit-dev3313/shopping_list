import { useNavigate } from "react-router";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { UpdateButton } from "./UpdateButton";

export function Page({
  title,
  back,
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        {back ? (
          <button
            className="back-btn"
            type="button"
            aria-label="Retour"
            onClick={() => navigate(back)}
          >
            <svg className="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span>Retour</span>
          </button>
        ) : null}
        <h1>{title}</h1>
        <UpdateButton />
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

export function Overlay({
  title,
  onClose,
  children,
  dismissOnBackdrop = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
}) {
  return createPortal(
    <div className="overlay" onClick={dismissOnBackdrop ? onClose : undefined}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>{title}</h2>
        {children}
        <button className="btn ghost" type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}
