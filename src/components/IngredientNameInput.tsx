import { useId, useRef, useState } from "react";

const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

export function IngredientNameInput({ value, names, onChange }: {
  value: string; names: string[]; onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = [...new Set(names)].filter((name) => searchable(name).includes(searchable(value.trim()))).slice(0, 50);
  const visible = open && matches.length > 0;
  const choose = (name: string) => { onChange(name); setOpen(false); setActive(-1); };
  return <div className="field ingredient-autocomplete" ref={root}>
    <label htmlFor={id}>Nom</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={visible}
      aria-controls={visible ? `${id}-list` : undefined}
      aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined}
      autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
      value={value} placeholder="Farine, lait…"
      onFocus={() => {
        setOpen(true);
        requestAnimationFrame(() => root.current?.scrollIntoView?.({ block: "nearest" }));
      }}
      onBlur={() => { setOpen(false); setActive(-1); }}
      onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); setActive(-1); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          const next = matches.length ? active < 0 ? (event.key === "ArrowDown" ? 0 : matches.length - 1) :
            (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : -1;
          setActive(next);
          requestAnimationFrame(() => document.getElementById(`${id}-${next}`)?.scrollIntoView?.({ block: "nearest" }));
        }
        if (event.key === "Enter" && visible && active >= 0) { event.preventDefault(); choose(matches[active]); }
      }} />
    {visible ? <div className="ingredient-suggestions" id={`${id}-list`} role="listbox" aria-label="Ingrédients existants">
      {matches.map((name, index) => <button type="button" role="option" id={`${id}-${index}`} key={name}
        aria-selected={active === index} tabIndex={-1}
        onPointerDown={(event) => event.preventDefault()} onClick={() => choose(name)}>{name}</button>)}
    </div> : null}
  </div>;
}
