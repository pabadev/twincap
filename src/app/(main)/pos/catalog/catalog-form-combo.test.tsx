// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogForm } from "./catalog-form";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

vi.mock("../../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("./actions", () => ({
  createCatalogItemAction: () => null,
  updateCatalogItemAction: () => null,
}));

vi.mock("../../../../lib/use-action-error", () => ({
  useActionError: () => (error: string) => error,
}));

vi.mock("../../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

/** The guided combo preset must fix the exact shape configureProductCombo requires. */
describe("CatalogForm guided combo kind", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  function mount(ui: React.ReactElement) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(ui));
  }

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  function getSelect(id: string): HTMLSelectElement {
    const select = document.getElementById(id);
    expect(select).not.toBeNull();
    return select as HTMLSelectElement;
  }

  function change(select: HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    act(() => {
      setter.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function hiddenFields(): Record<string, string | null> {
    return Object.fromEntries(
      [...container!.querySelectorAll('input[type="hidden"]')].map((input) => [
        input.getAttribute("name"),
        input.getAttribute("value"),
      ]),
    );
  }

  it("opens on a neutral selection and offers Combo only on create", () => {
    mount(<CatalogForm onDone={() => {}} />);

    const kind = getSelect("type");
    // Neutral default (founder rule): the select opens on an empty "select"
    // placeholder instead of pre-picking product.
    expect(kind.value).toBe("");
    const values = [...kind.options].map((option) => option.value);
    expect(values).toEqual(["", "product", "service", "combo"]);

    expect(container!.textContent).toContain("typeHint_none");
    change(kind, "product");
    expect(container!.textContent).toContain("typeHint_product");
    change(kind, "service");
    expect(container!.textContent).toContain("typeHint_service");
    change(kind, "combo");
    expect(container!.textContent).toContain("typeHint_combo");
  });

  it("hides role/unit/stock when Combo is selected and presets the combo shape", () => {
    mount(<CatalogForm onDone={() => {}} />);
    change(getSelect("type"), "combo");

    expect(document.getElementById("saleUnit")).toBeNull();
    expect(document.getElementById("productRole")).toBeNull();
    expect(document.getElementById("stock")).toBeNull();
    // Price stays editable (a combo has its own price).
    expect(document.getElementById("unitPrice")).not.toBeNull();

    const hidden = hiddenFields();
    expect(hidden.type).toBe("product");
    expect(hidden.productRole).toBe("sellable");
    expect(hidden.saleUnit).toBe("unit");
    expect(hidden.stock).toBe("0");
  });

  it("restores the regular product fields when switching back from Combo", () => {
    mount(<CatalogForm onDone={() => {}} />);
    const kind = getSelect("type");
    change(kind, "combo");
    change(kind, "product");

    expect(document.getElementById("saleUnit")).not.toBeNull();
    expect(document.getElementById("productRole")).not.toBeNull();
    expect(document.getElementById("stock")).not.toBeNull();
    expect(container!.textContent).toContain("typeHint_product");
  });

  it("keeps the edit mode limited to product and service", () => {
    const item: SerializedCatalogItem = {
      id: "item-1",
      workspaceId: "ws-1",
      name: "Regular product",
      unitPrice: { amount: 1000, currency: "COP" },
      type: "product",
      productRole: "sellable",
      saleUnit: "unit",
      formulaVersions: [],
      comboVersions: [],
      stock: 3,
      createdAt: new Date(0),
    };
    mount(<CatalogForm item={item} onDone={() => {}} />);

    const kind = getSelect("type");
    // Editing: no placeholder row and no combo option; the persisted type is
    // preloaded (the truth, not a neutral choice).
    expect([...kind.options].map((option) => option.value)).toEqual(["product", "service"]);
    expect(kind.value).toBe("product");
    expect(kind.disabled).toBe(true);
  });
});
