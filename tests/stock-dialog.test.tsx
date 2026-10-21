import { createContext, useContext, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type AppData } from "../src/lib/types";
import { StockDialog } from "../src/components/StockDialog";

const context = createContext({ data: emptyData(), updateData: (_updater: (data: AppData) => AppData) => {}, error: (_message: string) => {} });
function useTestApp() { return useContext(context); }
vi.mock("../src/context/AppContext", () => ({ useApp: () => useTestApp() }));
afterEach(cleanup);

function Harness() {
  const [data, setData] = useState<AppData>({ ...emptyData(),
    ingredients: [{ id: "tomato", name: "tomates" }, { id: "salt", name: "sel" }],
    recipes: [{ id: "r", name: "salade", ingredients: [
      { id: "t", ingredientId: "tomato", quantity: 50, unit: "-" }, { id: "s", ingredientId: "salt", quantity: 10, unit: "g" },
    ] }], shoppings: [{ id: "shopping", name: "soir", recipes: [{ id: "r-line", recipeId: "r", quantity: 1 }], extras: [], already: [] }],
  });
  const [open, setOpen] = useState(true);
  return <context.Provider value={{ data, updateData: (updater) => setData(updater), error: (message) => { throw new Error(message); } }}>
    {open ? <StockDialog shoppingId="shopping" onClose={() => setOpen(false)} /> : null}
    <output aria-label="Stock enregistré">{JSON.stringify(data.shoppings[0].already)}</output>
  </context.Provider>;
}

it("garde la liste ouverte après plusieurs choix, affiche les quantités et ferme uniquement via Fermer", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: /tomates/ }));
  const input = screen.getByRole("textbox", { name: "Quantité disponible de tomates" }) as HTMLInputElement;
  expect(input.value).toBe("50");
  await user.clear(input); await user.type(input, "30");
  await user.click(screen.getByRole("button", { name: "Confirmer la quantité" }));
  expect(screen.getByRole("dialog", { name: "Déjà à la maison" })).toBeTruthy();
  expect(screen.getByText("30 - déjà à la maison").className).toBe("stock-covered");
  expect(screen.getByText("20 - à acheter")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /^sel/ }));
  expect((screen.getByRole("textbox", { name: "Quantité disponible de sel" }) as HTMLInputElement).value).toBe("10");
  await user.click(screen.getByRole("button", { name: "Confirmer la quantité" }));
  expect(JSON.parse(screen.getByLabelText("Stock enregistré").textContent!)).toHaveLength(2);
  await user.click(document.querySelector(".overlay")!);
  expect(screen.getByRole("dialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /tomates/ }));
  await user.click(screen.getByRole("button", { name: "Retirer de « déjà à la maison »" }));
  expect(screen.getByText("50 - à acheter")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
