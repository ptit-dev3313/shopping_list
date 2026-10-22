import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngredientNameInput } from "../src/components/IngredientNameInput";

afterEach(cleanup);
function Harness() {
  const [value, setValue] = useState("");
  return <><IngredientNameInput value={value} onChange={setValue} names={["tomates", "thym", "crème", "sel"]} /><input aria-label="Quantité" /></>;
}
it("affiche les suggestions après le champ, filtre et permet de choisir au toucher", async () => {
  const user = userEvent.setup(); render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Nom" });
  await user.type(input, "tom");
  const list = screen.getByRole("listbox");
  expect(input.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(input.getAttribute("list")).toBeNull();
  expect(screen.queryByRole("option", { name: "sel" })).toBeNull();
  await user.click(screen.getByRole("option", { name: "tomates" }));
  expect((input as HTMLInputElement).value).toBe("tomates");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(input);
});
it("accepte les accents, le clavier et ferme le menu en quittant le champ", async () => {
  const user = userEvent.setup(); render(<Harness />);
  const input = screen.getByRole("combobox");
  await user.type(input, "cre");
  await user.keyboard("{ArrowDown}{Enter}");
  expect((input as HTMLInputElement).value).toBe("crème");
  await user.clear(input); await user.type(input, "t");
  expect(screen.getByRole("listbox")).toBeTruthy();
  await user.tab();
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Quantité" })).toBe(document.activeElement);
});
