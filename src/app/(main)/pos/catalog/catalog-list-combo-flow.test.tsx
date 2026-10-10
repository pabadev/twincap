// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogList } from "./catalog-list";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";

// Reproduction: guided combo creation must close the create modal AND open
// the composition modal with the freshly created item.

const formOnDone = vi.hoisted(() => ({
  current: undefined as ((...args: unknown[]) => void) | undefined | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

vi.mock("../../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

const createdCombo: SerializedCatalogItem = {
  id: "combo-new",
  workspaceId: "ws-1",
  name: "Combo creado",
  unitPrice: { amount: 45000, currency: "COP" },
  type: "product",
  productRole: "sellable",
  saleUnit: "unit",
  formulaVersions: [],
  comboVersions: [],
  stock: 0,
  inventoryValueMinor: 0,
  createdAt: new Date(0),
};

vi.mock("./catalog-form", () => ({
  CatalogForm: ({ onDone }: { onDone?: (...args: unknown[]) => void }) => {
    formOnDone.current = onDone ?? undefined;
    return (
      <button type="button" onClick={() => onDone?.(createdCombo, { openCombo: true })}>
        simulate-success
      </button>
    );
  },
}));

vi.mock("./actions", () => ({
  createCatalogItemAction: () => null,
  updateCatalogItemAction: () => null,
  deleteCatalogItemAction: () => null,
  adjustCatalogStockAction: () => null,
  getCatalogStockHistoryAction: () => ({ history: [] }),
}));

vi.mock("./delete-catalog-item-button", () => ({
  DeleteCatalogItemButton: () => <button type="button" />,
}));

vi.mock("./stock-controls", () => ({
  StockControls: () => <button type="button" />,
}));

vi.mock("./product-combo-form", () => ({
  ProductComboForm: ({ item }: { item: SerializedCatalogItem }) => (
    <div data-testid="combo-form">COMBO_FORM_OPEN:{item.id}</div>
  ),
}));

vi.mock("./product-formula-form", () => ({
  ProductFormulaForm: ({ item }: { item: SerializedCatalogItem }) => (
    <div data-testid="formula-form">FORMULA_FORM_OPEN:{item.id}</div>
  ),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  // Unmount INSIDE the still-alive jsdom environment: a lingering React 19
  // root schedules scheduler work (performWorkUntilDeadline) on node timers
  // that dereference `window` after teardown → unhandled ReferenceError in CI.
  if (root) {
    const mounted = root;
    act(() => mounted.unmount());
    root = undefined;
    container = undefined;
  }
  formOnDone.current = null;
  document.body.innerHTML = "";
});

describe("CatalogList guided combo flow", () => {
  function mount(ui: React.ReactElement) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(ui));
  }

  it("opens the composition modal after creating a combo", () => {
    mount(
      <CatalogList
        items={[
          {
            id: "p1",
            workspaceId: "ws-1",
            name: "Frasco",
            unitPrice: { amount: 1000, currency: "COP" },
            type: "product",
            productRole: "sellable",
            saleUnit: "unit",
            formulaVersions: [],
            comboVersions: [],
            stock: 10,
            inventoryValueMinor: 0,
            createdAt: new Date(0),
          },
        ]}
      />,
    );

    // Open the create modal first (the real user flow): the mock's onDone is
    // only captured while the modal content is mounted.
    const addButton = [...container!.querySelectorAll("button")].find(
      (button) => button.textContent === "addItem",
    );
    expect(addButton).toBeDefined();
    act(() => addButton!.click());

    expect(formOnDone.current).not.toBeNull();
    act(() => formOnDone.current?.(createdCombo, { openCombo: true }));

    expect(container!.querySelector('[data-testid="combo-form"]')).not.toBeNull();
    expect(container!.textContent).toContain("COMBO_FORM_OPEN:combo-new");
  });

  it("opens the recipe modal after creating a recipe", () => {
    const createdRecipe: SerializedCatalogItem = {
      id: "recipe-new",
      workspaceId: "ws-1",
      name: "Limonada preparada",
      unitPrice: { amount: 8000, currency: "COP" },
      type: "product",
      productRole: "sellable",
      saleUnit: "unit",
      formulaVersions: [],
      comboVersions: [],
      stock: 0,
      inventoryValueMinor: 0,
      createdAt: new Date(0),
    };
    mount(
      <CatalogList
        items={[
          {
            id: "p1",
            workspaceId: "ws-1",
            name: "Frasco",
            unitPrice: { amount: 1000, currency: "COP" },
            type: "product",
            productRole: "sellable",
            saleUnit: "unit",
            formulaVersions: [],
            comboVersions: [],
            stock: 10,
            inventoryValueMinor: 0,
            createdAt: new Date(0),
          },
        ]}
      />,
    );

    const addButton = [...container!.querySelectorAll("button")].find(
      (button) => button.textContent === "addItem",
    );
    expect(addButton).toBeDefined();
    act(() => addButton!.click());

    act(() => formOnDone.current?.(createdRecipe, { openRecipe: true }));

    expect(container!.querySelector('[data-testid="formula-form"]')).not.toBeNull();
    expect(container!.textContent).toContain("FORMULA_FORM_OPEN:recipe-new");
  });
});
