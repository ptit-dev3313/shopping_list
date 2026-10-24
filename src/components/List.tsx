import { useEffect, useId, useRef, type ReactNode } from "react";

export function AddRow({
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="add-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoCapitalize="none"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.toLocaleLowerCase("fr"))}
      />
      <button className="btn primary" type="submit">
        Ajouter
      </button>
    </form>
  );
}

export function SortableList({
  onReorder,
  children,
}: {
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const id = useId();
  const listId = `sort-${id.replace(/:/g, "")}`;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  useEffect(() => {
    const list = document.getElementById(listId);
    if (!list) return;
    let from: number | null = null;
    let pointerY = 0;
    let frame = 0;
    let lastTime = 0;
    let capture: { handle: Element; id: number } | null = null;
    const scrollParent = () => {
      for (let parent = list.parentElement; parent; parent = parent.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
      }
      return document.scrollingElement as HTMLElement;
    };
    const rows = () => [...list.querySelectorAll(":scope > .card-row")];
    const hit = (y: number) => {
      const items = rows();
      if (items.length === 0) return 0;
      let to = items.length - 1;
      for (let i = 0; i < items.length; i += 1) {
        const box = items[i]!.getBoundingClientRect();
        if (y <= box.top + box.height / 2) {
          to = i;
          break;
        }
      }
      return to;
    };
    const paint = (to: number) => {
      rows().forEach((row, index) => {
        row.classList.toggle("drop-target", from !== null && index === to && index !== from);
        row.classList.toggle("is-dragging", from !== null && index === from);
      });
    };
    const end = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      rows().forEach((row) => row.classList.remove("drop-target", "is-dragging"));
      from = null;
      if (capture?.handle.hasPointerCapture(capture.id)) capture.handle.releasePointerCapture(capture.id);
      capture = null;
    };
    const tick = (time: number) => {
      if (from === null) return;
      const parent = scrollParent();
      const isDocument = parent === document.scrollingElement;
      const box = parent.getBoundingClientRect();
      const top = isDocument ? 64 : Math.max(0, box.top);
      const bottom = isDocument ? window.innerHeight : Math.min(window.innerHeight, box.bottom);
      const edge = Math.min(96, (bottom - top) / 3);
      const speed = pointerY < top + edge ? -Math.min(1, (top + edge - pointerY) / edge)
        : pointerY > bottom - edge ? Math.min(1, (pointerY - bottom + edge) / edge) : 0;
      const elapsed = lastTime ? Math.min(32, time - lastTime) : 16;
      parent.scrollTop += speed * elapsed * 0.8;
      lastTime = time;
      paint(hit(pointerY));
      frame = requestAnimationFrame(tick);
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || from !== null) return;
      const target = event.target as HTMLElement;
      const handle = target.closest(".drag-handle");
      if (!handle || !list.contains(handle)) return;
      const row = handle.closest(".card-row");
      from = rows().indexOf(row as Element);
      if (from < 0) {
        from = null;
        return;
      }
      handle.setPointerCapture(event.pointerId);
      capture = { handle, id: event.pointerId };
      pointerY = event.clientY;
      frame = requestAnimationFrame(tick);
      paint(from);
      event.preventDefault();
      event.stopPropagation();
    };
    const onMove = (event: PointerEvent) => {
      if (from === null || capture?.id !== event.pointerId) return;
      pointerY = event.clientY;
      paint(hit(event.clientY));
      event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      const handle = (event.target as HTMLElement).closest(".drag-handle");
      if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      const fromIndex = rows().indexOf(handle.closest(".card-row")!);
      const to = Math.max(0, Math.min(rows().length - 1, fromIndex + (event.key === "ArrowUp" ? -1 : 1)));
      event.preventDefault();
      if (fromIndex !== to) onReorderRef.current(fromIndex, to);
      handle.scrollIntoView({ block: "nearest" });
    };
    const onUp = (event: PointerEvent) => {
      if (from === null || capture?.id !== event.pointerId) return;
      const start = from;
      const to = hit(event.clientY);
      end();
      if (start !== to) onReorderRef.current(start, to);
    };
    list.addEventListener("pointerdown", onDown);
    list.addEventListener("pointermove", onMove);
    list.addEventListener("pointerup", onUp);
    list.addEventListener("pointercancel", end);
    list.addEventListener("lostpointercapture", end);
    list.addEventListener("keydown", onKey);
    window.addEventListener("blur", end);
    return () => {
      end();
      list.removeEventListener("pointerdown", onDown);
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerup", onUp);
      list.removeEventListener("pointercancel", end);
      list.removeEventListener("lostpointercapture", end);
      list.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", end);
    };
  }, [listId]);

  return (
    <ul className="list" id={listId}>
      {children}
    </ul>
  );
}

export function ListRow({
  label,
  len,
  onOpen,
  extraLabel,
  onExtra,
  onDelete,
}: {
  label: string;
  len: number;
  onOpen?: () => void;
  extraLabel?: string;
  onExtra?: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="card-row">
      {len > 1 ? (
        <span className="drag-handle" role="button" tabIndex={0} aria-label={`Déplacer ${label} : glisser ou utiliser les flèches`} title="Glisser pour réordonner">
          ⋮⋮
        </span>
      ) : null}
      <span className="grow">{label}</span>
      {onOpen ? (
        <button className="icon-btn" type="button" onClick={onOpen}>
          ✎
        </button>
      ) : null}
      {onExtra && extraLabel ? (
        <button className="icon-btn accent" type="button" onClick={onExtra}>
          {extraLabel}
        </button>
      ) : null}
      {onDelete ? (
        <button className="icon-btn danger" type="button" onClick={onDelete}>
          ✕
        </button>
      ) : null}
    </li>
  );
}
