// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaleForm } from "./sale-form";
import { Modal } from "../../../../components/ui/modal";
import type { SerializedAccount } from "../../../../core/domain/account";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import type { SerializedClient } from "../../../../core/domain/client";

// UX-9 Slice B, R-6/R-7 (H-13): the POS sale clientId Select carries the real
// `required` state for credit sales (no manual asterisk) and, when the client
// is missing on a credit sale, the warning is associated via aria-describedby.
// Scenarios S6.1, S6.2, S7.3.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

vi.mock("../../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("./actions", () => ({
  createSaleAction: () => null,
}));

vi.mock("../../../../lib/use-action-error", () => ({
  useActionError: () => (error: string) => error,
}));

vi.mock("../../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

// ClientForm/CatalogForm pull server actions that boot the auth/env stack —
// irrelevant to the clientId semantics, so stub them out.
vi.mock("../../clients/client-form", () => ({
  ClientForm: ({ onSuccess }: { onSuccess: (client?: SerializedClient) => void }) => (
    <button type="button" data-testid="create-client-trigger" onClick={() => onSuccess(newClient)}>
      Create Client
    </button>
  ),
}));

// C12-3d: the CatalogForm mock renders a trigger button that calls onDone with
// a fully-formed item snapshot (name + price + currency), simulating the
// createCatalogItemAction return value. Tests use this to verify immediate
// propagation into the searcher options and the cart table.
const newCatalogItem: SerializedCatalogItem = {
  id: "cat-new",
  workspaceId: "ws-1",
  name: "New Item",
  unitPrice: { amount: 5000, currency: "COP" },
  type: "product",
  stock: 5,
  createdAt: new Date(0),
};

vi.mock("../catalog/catalog-form", () => ({
  CatalogForm: ({ onDone }: { onDone?: (item?: SerializedCatalogItem) => void }) => (
    <button
      type="button"
      data-testid="create-catalog-trigger"
      onClick={() => onDone?.(newCatalogItem)}
    >
      Create Item
    </button>
  ),
}));

// A1 (F2+F3): a newly created client must appear in the select options and
// be auto-selected.
const newClient: SerializedClient = {
  id: "cli-new",
  workspaceId: "ws-1",
  name: "New Client",
  phone: "",
  email: "",
  note: "",
  createdAt: new Date(0),
};

const catalogItems: SerializedCatalogItem[] = [
  {
    id: "c1",
    workspaceId: "ws-1",
    name: "Item A",
    unitPrice: { amount: 1000, currency: "COP" },
    type: "service",
    stock: 0,
    createdAt: new Date(0),
  },
  {
    id: "c2",
    workspaceId: "ws-1",
    name: "Item B",
    unitPrice: { amount: 2500, currency: "COP" },
    type: "product",
    stock: 10,
    createdAt: new Date(0),
  },
];

const accounts: SerializedAccount[] = [
  {
    id: "a1",
    workspaceId: "ws-1",
    name: "Checking",
    currency: "COP",
    isFixed: false,
    createdAt: new Date(0),
    version: 1,
  },
];

const clients: SerializedClient[] = [
  {
    id: "cli-1",
    workspaceId: "ws-1",
    name: "Client One",
    phone: "",
    email: "",
    note: "",
    createdAt: new Date(0),
  },
];

const baseProps = {
  catalogItems,
  accounts,
  clients,
  onDone: () => {},
};

interface Mounted {
  root: ReturnType<typeof createRoot>;
  container: HTMLElement;
  unmount: () => void;
}

const mounted: Mounted[] = [];

function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  const entry: Mounted = {
    root,
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(entry);
  return entry;
}

afterEach(() => {
  mounted.splice(0).forEach((entry) => entry.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function switchPaymentMode(container: HTMLElement, mode: string) {
  const select = container.querySelector<HTMLSelectElement>("#paymentMode")!;
  act(() => {
    select.value = mode;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/**
 * C12-3c: helper to select an item from the combobox by clicking the option
 * in the dropdown. Opens the dropdown by focusing the search input, then
 * clicks the option at the given index (0-based among filtered items).
 */
function selectFromSearch(container: HTMLElement, optionIndex = 0) {
  const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;
  // Focus the input. If the dropdown is not open, this opens it.
  act(() => {
    searchInput.focus();
  });
  // If the dropdown is still not open (e.g., catalog is empty), type something
  // to trigger the open. But normally, focusing with a non-empty catalog opens it.
  let listbox = container.querySelector<HTMLUListElement>("#item-search-listbox");
  if (!listbox) {
    // Force open by dispatching an input event.
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      nativeInputValueSetter.call(searchInput, searchInput.value || " ");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    listbox = container.querySelector<HTMLUListElement>("#item-search-listbox");
  }
  expect(listbox).not.toBeNull();
  const options = listbox!.querySelectorAll<HTMLLIElement>('[role="option"]');
  expect(options.length).toBeGreaterThan(optionIndex);
  act(() => {
    options[optionIndex].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

describe("SaleForm clientId required semantics (S6.1/S6.2)", () => {
  it("does not mark clientId required on a cash sale (S6.2)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const clientSelect = container.querySelector<HTMLSelectElement>("#clientId");
    expect(clientSelect).not.toBeNull();
    expect(clientSelect?.hasAttribute("required")).toBe(false);
  });

  it("marks clientId required on a credit sale and drops the asterisk (S6.1)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    switchPaymentMode(container, "on-credit");
    const clientSelect = container.querySelector<HTMLSelectElement>("#clientId");
    expect(clientSelect?.hasAttribute("required")).toBe(true);
    const label = container.querySelector<HTMLLabelElement>('label[for="clientId"]');
    expect(label?.textContent).toBe("client");
    expect(label?.textContent).not.toContain("*");
  });

  it("associates the missing-client hint with clientId via aria-describedby (S7.3)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    switchPaymentMode(container, "on-credit");
    // UX-10 D8: the hint wiring is centralized in FormField; the paragraph id
    // moved from `clientId-warning` to `clientId-hint`.
    const clientSelect = container.querySelector<HTMLSelectElement>("#clientId");
    expect(clientSelect?.getAttribute("aria-describedby")).toBe("clientId-hint");
    const warning = container.querySelector<HTMLElement>("#clientId-hint");
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toBe("clientRequiredForCredit");
    // On a cash sale there is no hint and no described-by binding.
    switchPaymentMode(container, "paid-in-full");
    const cashSelect = container.querySelector<HTMLSelectElement>("#clientId");
    expect(cashSelect?.getAttribute("aria-describedby")).toBeNull();
    expect(container.querySelector("#clientId-hint")).toBeNull();
  });
});

// C12-3c: the remove control is always visible (no "keep at least 1" rule
// since the cart starts empty).
describe("SaleForm remove-item control (C12-3c)", () => {
  it("renders an icon-only remove button with accessible name and tooltip", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Cart starts empty — no remove button yet.
    expect(container.querySelector('button[aria-label="remove"]')).toBeNull();

    // Add an item via the search combobox.
    selectFromSearch(container, 0);

    const remove = container.querySelector<HTMLButtonElement>('button[aria-label="remove"]');
    expect(remove).not.toBeNull();
    expect(remove!.getAttribute("title")).toBe("remove");
    // Icon-only: no visible text, the accessible name comes from aria-label.
    expect(remove!.textContent?.trim()).toBe("");
    expect(remove!.querySelector("svg")).not.toBeNull();
  });
});

// A1 (F2+F3): the client select must reflect locally created clients.
describe("SaleForm client auto-select (A1 F2+F3)", () => {
  it("appends the new client to options and auto-selects it after creation", () => {
    const { container } = mount(<SaleForm {...baseProps} />);

    // Open the client creation modal.
    const createClientBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("createClient"),
    );
    expect(createClientBtn).toBeDefined();
    act(() => {
      createClientBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The mocked ClientForm renders a trigger that calls onSuccess.
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-client-trigger"]',
    );
    expect(trigger).not.toBeNull();
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The new client must be in the select options and selected.
    const clientSelect = container.querySelector<HTMLSelectElement>("#clientId");
    expect(clientSelect).not.toBeNull();
    const optionValues = Array.from(clientSelect!.querySelectorAll("option")).map((o) => o.value);
    expect(optionValues).toContain("cli-new");
    expect(clientSelect!.value).toBe("cli-new");
  });
});

// C12-1: close-guard — unsaved changes must trigger a confirmation before
// discarding. The dirty flag is exposed via dirtyRef so the parent can read it
// synchronously in the close handler (no stale closures).
describe("SaleForm dirty tracking (C12-1 + C12-3c)", () => {
  it("starts clean: dirtyRef is false on mount with empty cart", () => {
    const dirtyRef = { current: false };
    mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    expect(dirtyRef.current).toBe(false);
  });

  it("becomes dirty when the user adds an item via search", () => {
    const dirtyRef = { current: false };
    const { container } = mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    selectFromSearch(container, 0);
    expect(dirtyRef.current).toBe(true);
  });

  it("becomes dirty when the user selects a client", () => {
    const dirtyRef = { current: false };
    const { container } = mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    const clientSelect = container.querySelector<HTMLSelectElement>("#clientId")!;
    act(() => {
      clientSelect.value = "cli-1";
      clientSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(dirtyRef.current).toBe(true);
  });

  it("becomes dirty when the user changes payment mode", () => {
    const dirtyRef = { current: false };
    const { container } = mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    switchPaymentMode(container, "on-credit");
    expect(dirtyRef.current).toBe(true);
  });

  it("stays clean when the cart is empty and defaults untouched", () => {
    const dirtyRef = { current: false };
    mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    expect(dirtyRef.current).toBe(false);
  });
});

// C12-1: the Cancel button must call onCancel (wired to the close-guard) when
// provided, not onDone directly. This lets the parent show a confirmation.
describe("SaleForm Cancel button (C12-1)", () => {
  it("calls onCancel when provided", () => {
    const onCancel = vi.fn();
    const { container } = mount(<SaleForm {...baseProps} onCancel={onCancel} />);
    const cancelBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "cancel",
    );
    expect(cancelBtn).toBeDefined();
    act(() => {
      cancelBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("falls back to onDone when onCancel is not provided", () => {
    const onDone = vi.fn();
    const { container } = mount(<SaleForm {...baseProps} onDone={onDone} />);
    const cancelBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "cancel",
    );
    act(() => {
      cancelBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// C12-3: desktop POS layout — the form must expose a responsive grid with
// three zones (settings, cart, summary) so desktop viewports can use the
// horizontal space without stretching the mobile form. Mobile keeps the
// original single-column order (settings → cart → summary).
describe("SaleForm responsive layout (C12-3 + C12-3c)", () => {
  it("wraps the form body in a responsive grid container with lg: breakpoint classes", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    // The grid wrapper is the first child div inside the form (after hidden inputs).
    const gridWrapper = form!.querySelector(".lg\\:grid.lg\\:grid-cols-\\[1fr_320px\\]");
    expect(gridWrapper).not.toBeNull();
  });

  it("places the line items section (search + table) in the left column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // C12-3e: left column is the first child of the grid wrapper.
    const form = container.querySelector("form");
    const gridWrapper = form!.querySelector(".lg\\:grid.lg\\:grid-cols-\\[1fr_320px\\]");
    const cartSection = gridWrapper!.children[0] as HTMLElement;
    expect(cartSection).toBeDefined();
    // The search combobox lives inside the cart section.
    expect(cartSection.querySelector("#item-search")).not.toBeNull();
    // The "createNewItem" link lives inside the cart section.
    const createItemBtn = [...cartSection.querySelectorAll("button")].find(
      (b) => b.textContent === "createNewItem",
    );
    expect(createItemBtn).toBeDefined();
  });

  it("places the settings section (payment, client, date) in the right column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const settingsSection = container.querySelector('[data-testid="right-column"]');
    expect(settingsSection).not.toBeNull();
    expect(settingsSection!.querySelector("#paymentMode")).not.toBeNull();
    expect(settingsSection!.querySelector("#clientId")).not.toBeNull();
    expect(settingsSection!.querySelector("#date")).not.toBeNull();
  });

  it("places the summary + actions in a footer pinned at the bottom of the form (C12-3e)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // C12-3e: the footer is outside the grid, as a sibling of the grid wrapper.
    // It's shrink-0 with border-top, pinned at the bottom of the form.
    const footerSection = container.querySelector('[data-testid="sale-footer"]');
    expect(footerSection).not.toBeNull();
    expect(footerSection!.textContent).toContain("total");
    const submitBtn = [...footerSection!.querySelectorAll("button")].find(
      (b) => b.type === "submit",
    );
    expect(submitBtn).toBeDefined();
  });

  it("renders the total amount in the pinned footer section", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add an item so the total is non-zero.
    selectFromSearch(container, 0);
    const footerSection = container.querySelector('[data-testid="sale-footer"]');
    expect(footerSection!.textContent).toContain("total");
    // Total = 1 item × qty 1 × unitPrice 1000 = 1000 COP.
    expect(footerSection!.textContent).toContain("1000");
  });

  it("keeps DOM order stable and reorders visually on mobile: payment → cart → footer (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const form = container.querySelector("form");
    // C12-3i: DOM order is unchanged (cart first, settings second) — the mobile
    // reordering is purely visual via max-lg:order-first on the settings
    // section, so the desktop grid placement is untouched.
    const gridWrapper = form!.querySelector(".lg\\:grid.lg\\:grid-cols-\\[1fr_320px\\]");
    expect(gridWrapper).not.toBeNull();
    const gridChildren = Array.from(gridWrapper!.children);
    expect(gridChildren.length).toBe(2);
    // First DOM child: cart (contains search combobox)
    expect(gridChildren[0].querySelector("#item-search")).not.toBeNull();
    // Second DOM child: settings (contains #paymentMode) — visually FIRST on
    // mobile (payment block before the searcher, owner spec C12-3i).
    expect(gridChildren[1].querySelector("#paymentMode")).not.toBeNull();
    expect(gridChildren[1].className).toContain("max-lg:order-first");
    // The cart section carries the mobile section gap explicitly (the wrapper
    // space-y was removed: it would put the margin on the DOM-2nd child which
    // renders first on mobile).
    expect(gridChildren[0].className).toContain("max-lg:mt-4");
    // Footer is a sibling of the grid wrapper.
    const footer = form!.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    const submitBtn = footer!.querySelector('button[type="submit"]');
    expect(submitBtn).not.toBeNull();
  });
});

// C12-3b + C12-3c: visual hierarchy refinements — desktop table layout, action
// hierarchy, numeric formatting, and styling improvements.
describe("SaleForm visual hierarchy (C12-3b + C12-3c)", () => {
  it("renders the header row with column labels at ALL breakpoints (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add an item so the table renders.
    selectFromSearch(container, 0);
    // C12-3i: the header is visible on mobile too (the mobile rows are
    // single-line grid rows; the header is their only label source). It is
    // NOT hidden — no `hidden` class.
    const headerRow = container.querySelector('[data-testid="table-header"]');
    expect(headerRow).not.toBeNull();
    expect(headerRow!.className).not.toContain("hidden");
    expect(headerRow!.textContent).toContain("item");
    expect(headerRow!.textContent).toContain("qty");
    expect(headerRow!.textContent).toContain("unitPrice");
    expect(headerRow!.textContent).toContain("subtotal");
    // C12-3h: "actions" header text removed (empty cell).
    expect(headerRow!.textContent).not.toContain("actions");
  });

  it("renders subtotal as formatted text (not an input) right-aligned", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    // C12-3i: the subtotal is one grid cell (data-testid) holding a compact
    // mobile span (no currency code) and the full desktop span.
    const subtotalCells = container.querySelectorAll('[data-testid="subtotal-cell"]');
    expect(subtotalCells.length).toBe(1);
    // The subtotal is formatted text, not an input.
    expect(subtotalCells[0].querySelector("input")).toBeNull();
    // Right-aligned numeric cell (header lockstep).
    expect(subtotalCells[0].className).toContain("text-right");
    // Contains the formatted amount (1 × 1000 = 1000 COP).
    expect(subtotalCells[0].textContent).toContain("1000");
    // Desktop span keeps the full format with the currency code.
    const full = subtotalCells[0].querySelector('[data-testid="subtotal-full"]');
    expect(full).not.toBeNull();
    expect(full!.textContent).toContain("COP");
    // Mobile span omits the currency code suffix (compact numerals).
    const compact = subtotalCells[0].querySelector('[data-testid="subtotal-compact"]');
    expect(compact).not.toBeNull();
    expect(compact!.textContent).not.toContain("COP");
    expect(compact!.textContent).toContain("1000");
  });

  it("renders delete button with neutral base styling (red on hover)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const removeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="remove"]');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn!.className).toMatch(/text-zinc-(400|500)/);
    expect(removeBtn!.className).toContain("hover:text-danger");
  });

  it("renders 'createNewItem' as a blue text link (not a filled button)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const createItemBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "createNewItem",
    );
    expect(createItemBtn).toBeDefined();
    expect(createItemBtn!.className).toContain("text-xs");
    // C12-3h: blue (text-primary) to match "Crear cliente" link style.
    expect(createItemBtn!.className).toContain("text-primary");
    expect(createItemBtn!.className).toContain("font-medium");
    expect(createItemBtn!.className).not.toContain("bg-primary");
    expect(createItemBtn!.className).not.toContain("bg-zinc-100");
  });

  it("renders unit price input as text type with inputMode decimal (format-on-blur)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(priceInput).not.toBeNull();
    expect(priceInput!.type).toBe("text");
    expect(priceInput!.getAttribute("inputmode")).toBe("decimal");
  });

  it("aligns numeric inputs with their headers: qty centered, price right (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const qtyInput = container.querySelector<HTMLInputElement>('input[id^="qty-"]');
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(qtyInput).not.toBeNull();
    expect(priceInput).not.toBeNull();
    // C12-3i: the qty input is CENTER-aligned at every breakpoint — one
    // shared alignment with the centered "Cant." header (the old
    // sm:text-right broke header/content lockstep). The price input keeps
    // the right alignment under the right-aligned "unitPrice" header.
    expect(qtyInput!.className).toContain("text-center");
    expect(qtyInput!.className).not.toContain("text-right");
    expect(priceInput!.className).toContain("text-right");
  });

  it("applies warning tint to credit-mode client hint when client is missing", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    switchPaymentMode(container, "on-credit");
    const hint = container.querySelector<HTMLElement>("#clientId-hint");
    expect(hint).not.toBeNull();
    // C12-3e: amber-500 (#F59E0B) per spec, font-size 0.825rem.
    expect(hint!.className).toContain("text-amber-500");
    expect(hint!.className).toContain("text-[0.825rem]");
    expect(hint!.className).toContain("font-medium");
  });
});

// C12-3c: POS pattern — single top search adds items to cart.
describe("SaleForm POS search-add pattern (C12-3c)", () => {
  it("selecting an item from the search combobox adds a row to the cart", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Cart starts empty.
    expect(container.querySelectorAll('input[id^="qty-"]').length).toBe(0);

    selectFromSearch(container, 0);

    // One row in the cart.
    const qtyInputs = container.querySelectorAll<HTMLInputElement>('input[id^="qty-"]');
    expect(qtyInputs.length).toBe(1);
    expect(qtyInputs[0].value).toBe("1");
  });

  it("selecting the same item again increments quantity (no new row)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    selectFromSearch(container, 0);

    // Still one row, but quantity is 2.
    const qtyInputs = container.querySelectorAll<HTMLInputElement>('input[id^="qty-"]');
    expect(qtyInputs.length).toBe(1);
    expect(qtyInputs[0].value).toBe("2");
  });

  it("selecting different items creates separate rows", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0); // Item A
    selectFromSearch(container, 1); // Item B

    const qtyInputs = container.querySelectorAll<HTMLInputElement>('input[id^="qty-"]');
    expect(qtyInputs.length).toBe(2);
  });

  it("removing a row removes it from the cart", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    selectFromSearch(container, 1);
    expect(container.querySelectorAll('input[id^="qty-"]').length).toBe(2);

    // Click the first remove button.
    const removeBtns = container.querySelectorAll<HTMLButtonElement>('button[aria-label="remove"]');
    expect(removeBtns.length).toBe(2);
    act(() => {
      removeBtns[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelectorAll('input[id^="qty-"]').length).toBe(1);
  });

  it("editing quantity updates the subtotal", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0); // Item A, unitPrice 1000

    const qtyInput = container.querySelector<HTMLInputElement>('input[id^="qty-0"]')!;
    // React listens to the "input" event for onChange on number inputs.
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      nativeInputValueSetter.call(qtyInput, "3");
      qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Subtotal should be 3 × 1000 = 3000.
    const subtotalCells = container.querySelectorAll('[data-testid="subtotal-cell"]');
    expect(subtotalCells.length).toBe(1);
    expect(subtotalCells[0].textContent).toContain("3000");
  });

  it("search combobox keyboard select (Enter) adds a row", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;

    // Focus to open the dropdown.
    act(() => {
      searchInput.focus();
    });
    expect(container.querySelector("#item-search-listbox")).not.toBeNull();

    // Arrow down to first item, then Enter.
    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const qtyInputs = container.querySelectorAll<HTMLInputElement>('input[id^="qty-"]');
    expect(qtyInputs.length).toBe(1);
    expect(qtyInputs[0].value).toBe("1");
  });

  it("Escape closes the combobox dropdown without adding", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;

    act(() => {
      searchInput.focus();
    });
    expect(container.querySelector("#item-search-listbox")).not.toBeNull();

    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    // Dropdown closed.
    expect(container.querySelector("#item-search-listbox")).toBeNull();
    // No items added.
    expect(container.querySelectorAll('input[id^="qty-"]').length).toBe(0);
  });

  it("search filters catalog items by name", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;

    act(() => {
      searchInput.focus();
      // Type "B" to filter to Item B only.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      nativeInputValueSetter.call(searchInput, "B");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const listbox = container.querySelector("#item-search-listbox");
    expect(listbox).not.toBeNull();
    const options = listbox!.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain("Item B");
  });

  // Clear button: hidden with an empty input + closed dropdown, visible with
  // either text or an open dropdown, and clicking it clears the input, closes
  // the dropdown and does not reopen it (focus left on the input, no reopen).
  it("clear button appears with text or open dropdown and clears search", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;

    // Hidden when the input is empty and the dropdown is closed.
    expect(container.querySelector('[aria-label="clearItemSearch"]')).toBeNull();

    // Visible when the input is focused (dropdown open, empty text).
    act(() => {
      searchInput.focus();
    });
    const clearBtn = container.querySelector<HTMLButtonElement>('[aria-label="clearItemSearch"]')!;
    expect(clearBtn).not.toBeNull();

    // Close the dropdown (Escape) — the button stays visible because the input
    // still holds text? No: input is empty, so after closing the dropdown the
    // button disappears. First type text, close dropdown, then clear.
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      nativeInputValueSetter.call(searchInput, "B");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    // Dropdown closed, but the button remains visible because there is text.
    expect(container.querySelector("#item-search-listbox")).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="clearItemSearch"]'),
    ).not.toBeNull();

    // Click clears the input, hides the button, and the dropdown stays closed.
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="clearItemSearch"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(searchInput.value).toBe("");
    expect(container.querySelector('[aria-label="clearItemSearch"]')).toBeNull();
    expect(container.querySelector("#item-search-listbox")).toBeNull();
  });
});

// C12-3d: immediate propagation — a catalog item created from inside the form
// must appear in the searcher options immediately (no page refresh) and the
// table row must render with name and price (no empty/undefined cells).
describe("SaleForm catalog propagation (C12-3d)", () => {
  it("created item appears in searcher options immediately after creation", () => {
    const { container } = mount(<SaleForm {...baseProps} />);

    // Open the catalog creation modal.
    const createItemBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("createNewItem"),
    );
    expect(createItemBtn).toBeDefined();
    act(() => {
      createItemBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The mocked CatalogForm renders a trigger that calls onDone with the new item.
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-catalog-trigger"]',
    );
    expect(trigger).not.toBeNull();
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The new item must be in the searcher options.
    const searchInput = container.querySelector<HTMLInputElement>("#item-search")!;
    act(() => {
      searchInput.focus();
    });
    const listbox = container.querySelector("#item-search-listbox");
    expect(listbox).not.toBeNull();
    const options = listbox!.querySelectorAll('[role="option"]');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes("New Item"))).toBe(true);
    // Original items are still present.
    expect(optionTexts.some((t) => t?.includes("Item A"))).toBe(true);
    expect(optionTexts.some((t) => t?.includes("Item B"))).toBe(true);
  });

  it("created item is auto-added to the cart with correct name and price (no undefined row)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);

    // Trigger creation.
    const createItemBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("createNewItem"),
    );
    act(() => {
      createItemBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-catalog-trigger"]',
    );
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The new item must be in the cart (qty input exists).
    const qtyInputs = container.querySelectorAll<HTMLInputElement>('input[id^="qty-"]');
    expect(qtyInputs.length).toBe(1);
    expect(qtyInputs[0].value).toBe("1");

    // The row must show the item name (not empty/undefined) in the single
    // truncated name cell (C12-3i unified mobile/desktop cell).
    const nameCell = container.querySelector('[data-testid="item-name-cell"]');
    expect(nameCell).not.toBeNull();
    expect(nameCell!.textContent).toBe("New Item");
    expect(nameCell!.textContent).not.toContain("undefined");
    // C12-3i: the name truncates and carries the full name as title tooltip.
    expect(nameCell!.className).toContain("truncate");
    expect(nameCell!.getAttribute("title")).toBe("New Item");

    // The price input must show the catalog price (5000), not 0 or NaN.
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(priceInput).not.toBeNull();
    expect(priceInput!.value).toContain("5000");
  });

  it("created item currency is propagated to the form state", () => {
    const { container } = mount(<SaleForm {...baseProps} />);

    const createItemBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("createNewItem"),
    );
    act(() => {
      createItemBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="create-catalog-trigger"]',
    );
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The subtotal cell should format in COP (the new item's currency).
    const subtotalCell = container.querySelector('[data-testid="subtotal-cell"]');
    expect(subtotalCell).not.toBeNull();
    // Desktop span: full format with the currency code.
    const full = subtotalCell!.querySelector('[data-testid="subtotal-full"]');
    expect(full).not.toBeNull();
    expect(full!.textContent).toContain("5000");
    expect(full!.textContent).toContain("COP");
    // Mobile span: compact value without the currency code (C12-3i).
    const compact = subtotalCell!.querySelector('[data-testid="subtotal-compact"]');
    expect(compact).not.toBeNull();
    expect(compact!.textContent).toContain("5000");
    expect(compact!.textContent).not.toContain("COP");
  });
});

// C12-3d: scroll isolation & fixed structure — the modal layout must expose
// class-based hooks for the scroll-isolated table, the stable right column,
// and the pinned footer. jsdom does not compute styles, so we assert classes.
describe("SaleForm scroll isolation & fixed structure (C12-3d)", () => {
  it("table rows container has overflow-y-auto for scroll isolation on desktop", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const rowsContainer = container.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer).not.toBeNull();
    expect(rowsContainer!.className).toContain("overflow-y-auto");
    expect(rowsContainer!.className).toContain("overflow-x-hidden");
  });

  it("table header lives INSIDE the scroll container, sticky at lg (C12-3i lockstep)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    // C12-3i root-cause fix: the header shares the rows container's exact
    // content box (scrollbar included), so header and row columns stay in
    // lockstep on every platform. It must not scroll away: sticky top with an
    // opaque background at lg.
    const tableWrapper = container.querySelector('[data-testid="table-wrapper"]');
    expect(tableWrapper).not.toBeNull();
    const rowsContainer = tableWrapper!.querySelector('[data-testid="table-rows-container"]');
    const headerRow = tableWrapper!.querySelector('[data-testid="table-header"]');
    expect(headerRow).not.toBeNull();
    expect(rowsContainer!.contains(headerRow!)).toBe(true);
    expect(headerRow!.className).toContain("lg:sticky");
    expect(headerRow!.className).toContain("lg:top-0");
    expect(headerRow!.className).toContain("lg:bg-surface-card");
  });

  it("right column is fixed (no scroll) with min-h-0 chain on desktop", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const rightColumn = container.querySelector('[data-testid="right-column"]');
    expect(rightColumn).not.toBeNull();
    // C12-3f: right column is FIXED (no scroll), all fields visible 100% of the time.
    expect(rightColumn!.className).toContain("overflow-hidden");
    expect(rightColumn!.className).toContain("min-h-0");
  });

  it("footer is shrink-0 with border-top and matches modal background", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const footer = container.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("shrink-0");
    expect(footer!.className).toContain("border-t");
    expect(footer!.className).toContain("border-surface-border");
    expect(footer!.className).toContain("bg-surface-card");
  });

  it("form root fills modal body on desktop (lg:h-full), auto-height on mobile (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const root = container.querySelector("form")!.parentElement;
    expect(root).not.toBeNull();
    expect(root!.className).toContain("lg:h-full");
    expect(root!.className).toContain("flex");
    expect(root!.className).toContain("flex-col");
  });

  it("credit hint has legible amber color and is placed under the client selector", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    switchPaymentMode(container, "on-credit");
    const hint = container.querySelector<HTMLElement>("#clientId-hint");
    expect(hint).not.toBeNull();
    // C12-3e: amber-500 (#F59E0B) for legibility in both light and dark mode.
    expect(hint!.className).toContain("text-amber-500");
    // The hint is a <p> rendered by FormField AFTER the <Select>, so it's
    // visually under the client selector. Verify DOM order: label → select → hint.
    const parent = hint!.parentElement!;
    const children = Array.from(parent.children);
    const hintIdx = children.indexOf(hint!);
    // The hint should not be the first child (label and select come before it).
    expect(hintIdx).toBeGreaterThan(0);
  });
});

// C12-3f: layout invariants — the modal must have a definite height/width at
// desktop, the min-h-0 chain must be present on every flex/grid descendant
// between dialog and rows-scroll container, and the header/footer must be
// fixed (shrink-0) with the rows container as the ONLY scroll region.
describe("SaleForm layout invariants (C12-3f)", () => {
  // Helper to wrap SaleForm in a Modal (as it's used in production).
  function mountWithModal(node: ReactNode) {
    return mount(
      <Modal open={true} onClose={() => {}} title="Crear venta" variant="workspace">
        {node}
      </Modal>,
    );
  }

  it("dialog has definite height and width classes at desktop breakpoint", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    // The dialog is the [role="dialog"] element rendered by Modal.
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // C12-3g: workspace variant sets lg:h-[90vh] and lg:w-[94vw] lg:max-w-[1180px]
    // (bumped from 85vh/92vw/1080px for real-world laptop viewports 1366×653).
    expect(dialog!.className).toContain("lg:h-[90vh]");
    expect(dialog!.className).toContain("lg:w-[94vw]");
    expect(dialog!.className).toContain("lg:max-w-[1180px]");
  });

  it("body wrapper has min-h-0 chain for flex/grid sizing", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    // The body wrapper is the modal-body-workspace element.
    const bodyWrapper = container.querySelector('[data-testid="modal-body-workspace"]');
    expect(bodyWrapper).not.toBeNull();
    expect(bodyWrapper!.className).toContain("min-h-0");
    expect(bodyWrapper!.className).toContain("flex-1");
    // C12-3i: the workspace body scrolls naturally below lg (mobile is one
    // scroll unit — nothing clipped) and is scroll-frozen at lg+ where the
    // sale form manages isolated internal scroll regions.
    expect(bodyWrapper!.className).toContain("overflow-y-auto");
    expect(bodyWrapper!.className).toContain("lg:overflow-hidden");
  });

  it("rows container has overflow-y-auto + min-h-0 for scroll isolation", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const rowsContainer = container.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer).not.toBeNull();
    expect(rowsContainer!.className).toContain("overflow-y-auto");
    expect(rowsContainer!.className).toContain("min-h-0");
    expect(rowsContainer!.className).toContain("flex-1");
  });

  it("header and footer are shrink-0 (fixed, never scroll away)", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    // Modal header (title + X button).
    const modalHeader = container.querySelector('[role="dialog"] > .relative.z-10');
    expect(modalHeader).not.toBeNull();
    expect(modalHeader!.className).toContain("shrink-0");
    // Sale footer (Total + actions).
    const footer = container.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("shrink-0");
    expect(footer!.className).toContain("relative");
    expect(footer!.className).toContain("z-10");
  });

  it("right column is overflow-hidden (no scroll, all fields visible)", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    const rightColumn = container.querySelector('[data-testid="right-column"]');
    expect(rightColumn).not.toBeNull();
    expect(rightColumn!.className).toContain("overflow-hidden");
    expect(rightColumn!.className).toContain("min-h-0");
  });

  it("with many rows (40 items), footer/header remain siblings of scroll container", () => {
    // Render 40 items to stress-test the layout.
    const manyItems: SerializedCatalogItem[] = Array.from({ length: 40 }, (_, i) => ({
      id: `item-${i}`,
      workspaceId: "ws-1",
      name: `Item ${i}`,
      unitPrice: { amount: 1000 + i, currency: "COP" },
      type: "product",
      stock: 10,
      createdAt: new Date(0),
    }));
    const { container } = mountWithModal(<SaleForm {...baseProps} catalogItems={manyItems} />);
    // Add all 40 items to the cart.
    for (let i = 0; i < 40; i++) {
      selectFromSearch(container, 0);
    }
    // The rows container must exist and be the ONLY scroll region.
    const rowsContainer = container.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer).not.toBeNull();
    expect(rowsContainer!.className).toContain("overflow-y-auto");
    // The footer must be a sibling of the grid wrapper (not inside rows container).
    const footer = container.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    expect(rowsContainer!.contains(footer!)).toBe(false);
    // The modal header must be a sibling of the body (not inside rows container).
    const modalHeader = container.querySelector('[role="dialog"] > .relative.z-10');
    expect(modalHeader).not.toBeNull();
    expect(rowsContainer!.contains(modalHeader!)).toBe(false);
    // The table header row lives INSIDE the rows container (C12-3i lockstep)
    // and stays visible via sticky positioning while rows scroll under it.
    const tableHeader = rowsContainer!.querySelector('[data-testid="table-header"]');
    expect(tableHeader).not.toBeNull();
    expect(tableHeader!.className).toContain("lg:sticky");
  });
});

// C12-3g: real-browser fine-tuning — wider/taller modal, one-line footer,
// compact right column for credit-mode fit, and widened table columns to
// reserve room for the vertical scrollbar.
describe("SaleForm real-browser fine-tuning (C12-3g)", () => {
  it("footer stays one row on mobile and a 2-cell grid mirror at lg (C12-3g + C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const footer = container.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    // Mobile: one flex row (wraps only if the buttons cannot fit at 375px).
    expect(footer!.className).toContain("flex");
    expect(footer!.className).toContain("flex-wrap");
    expect(footer!.className).toContain("items-center");
    // Desktop: the footer MIRRORS the body grid (same 2-track template + gap)
    // so its left cell has the exact width of the table's left column.
    expect(footer!.className).toContain("lg:grid");
    expect(footer!.className).toContain("lg:grid-cols-[1fr_320px]");
    expect(footer!.className).toContain("lg:gap-6");
    // Total and buttons are present; compact vertical padding kept.
    expect(footer!.textContent).toContain("total");
    const submitBtn = footer!.querySelector('button[type="submit"]');
    expect(submitBtn).not.toBeNull();
    expect(footer!.className).toContain("py-3");
    // C12-3i: the old horizontal px-4 inset is gone — the footer grid shares
    // the body grid's edges (part of the real-alignment fix).
    expect(footer!.className).not.toContain("px-4");
  });

  it("anchors the Total to the Subtotal column via the same grid template + scrollbar gutter (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const footer = container.querySelector('[data-testid="sale-footer"]');
    expect(footer).not.toBeNull();
    // The left region reuses the table's exact 5-track template + gaps, and
    // reserves the same scrollbar gutter the rows container reserves, so the
    // Total's right edge lands exactly on the rows' Subtotal right edge.
    const region = footer!.querySelector('[data-testid="footer-total-region"]');
    expect(region).not.toBeNull();
    expect(region!.className).toContain("lg:grid-cols-[2fr_60px_110px_110px_48px]");
    expect(region!.className).toContain("lg:gap-2");
    expect(region!.className).toContain("lg:overflow-hidden");
    expect(region!.className).toContain("lg:[scrollbar-gutter:stable]");
    // The Total sits in the Subtotal track (4th), right-aligned.
    const total = footer!.querySelector('[data-testid="sale-total"]');
    expect(total).not.toBeNull();
    expect(total!.className).toContain("lg:col-start-4");
    expect(total!.className).toContain("lg:text-right");
    expect(total!.className).toContain("whitespace-nowrap");
    // The old pixel-guess compensation is gone.
    expect(total!.className).not.toContain("pr-[56px]");
    // The rows container reserves the gutter too (constant content width
    // whether the scrollbar is visible or not), and the old pr-2 hack is gone.
    const rowsContainer = container.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer!.className).toContain("lg:[scrollbar-gutter:stable]");
    expect(rowsContainer!.className).not.toContain("pr-2");
  });

  it("right column has compact vertical rhythm (text-xs labels, h-9 inputs, space-y-2)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const rightColumn = container.querySelector('[data-testid="right-column"]');
    expect(rightColumn).not.toBeNull();
    // C12-3g: space-y-2 for compact spacing.
    expect(rightColumn!.className).toContain("space-y-2");
    // Labels should have text-xs class (compact).
    const labels = rightColumn!.querySelectorAll("label");
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.className).toContain("text-xs");
    });
    // Inputs/Selects should have h-9 class (compact height).
    const inputs = rightColumn!.querySelectorAll("input, select");
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => {
      // The className is on the input/select element itself.
      expect(input.className).toContain("h-9");
    });
  });

  it("table header and rows share the SAME grid template at mobile and lg (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const headerRow = container.querySelector('[data-testid="table-header"]');
    expect(headerRow).not.toBeNull();
    // Mobile template: all 4 data columns + the reserved actions track.
    expect(headerRow!.className).toContain("grid-cols-[minmax(0,1fr)_40px_64px_64px_40px]");
    // Desktop template (unchanged since C12-3g).
    expect(headerRow!.className).toContain("lg:grid-cols-[2fr_60px_110px_110px_48px]");
    // Rows use the exact same templates + gaps — lockstep by construction.
    const rows = container.querySelectorAll(
      '[data-testid="table-rows-container"] > div:not([data-testid="table-header"])',
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.className).toContain("grid-cols-[minmax(0,1fr)_40px_64px_64px_40px]");
      expect(row.className).toContain("lg:grid-cols-[2fr_60px_110px_110px_48px]");
      expect(row.className).toContain("gap-x-1.5");
      expect(row.className).toContain("lg:gap-2");
    });
    // The header carries the same gaps as the rows.
    expect(headerRow!.className).toContain("gap-x-1.5");
    expect(headerRow!.className).toContain("lg:gap-2");
  });

  it("reserves the scrollbar width deterministically instead of the old pr-2 (C12-3i)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const rowsContainer = container.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer).not.toBeNull();
    // scrollbar-gutter:stable keeps the content width CONSTANT whether the
    // scrollbar is visible or not — no more header shifted by the scrollbar.
    expect(rowsContainer!.className).toContain("lg:[scrollbar-gutter:stable]");
    // The old pr-2 hack (8px) is gone: it never matched the real scrollbar
    // width (10px project webkit scrollbar) and misaligned the header.
    expect(rowsContainer!.className).not.toContain("pr-2");
  });

  it("credit hint uses amber-500 without gray override from base classes", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    switchPaymentMode(container, "on-credit");
    const hint = container.querySelector<HTMLElement>("#clientId-hint");
    expect(hint).not.toBeNull();
    // C12-3g: FormField now skips default text-zinc-500 when hintClassName is
    // provided, so amber-500 wins (no gray override from base classes).
    expect(hint!.className).toContain("text-amber-500");
    expect(hint!.className).not.toContain("text-zinc-500");
    expect(hint!.className).toContain("text-[0.825rem]");
    expect(hint!.className).toContain("font-medium");
  });

  it("rows have compact padding (py-1.5 mobile, lg:py-2 desktop) and horizontal-only borders", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    // C12-3i: the header row now lives INSIDE the rows container (lockstep
    // fix) — exclude it from the data-row assertions.
    const rows = container.querySelectorAll(
      '[data-testid="table-rows-container"] > div:not([data-testid="table-header"])',
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      // C12-3h: compact row padding (py-1.5 mobile, lg:py-2 desktop).
      expect(row.className).toContain("py-1.5");
      expect(row.className).toContain("lg:py-2");
      // C12-3h: horizontal-only borders (border-b, no border-x or full border).
      expect(row.className).toContain("border-b");
      expect(row.className).not.toMatch(/\bborder\s/);
      expect(row.className).not.toContain("border-x");
    });
    // The header keeps its own separator (no row padding): pb-2 + border-b.
    const header = container.querySelector('[data-testid="table-header"]')!;
    expect(header).not.toBeNull();
    expect(header.className).toContain("pb-2");
    expect(header.className).toContain("border-b");
  });

  it("mobile rows keep ALL 4 data columns + actions on one line (C12-3i redesign)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const rows = container.querySelectorAll(
      '[data-testid="table-rows-container"] > div:not([data-testid="table-header"])',
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      // C12-3i: the owner-rejected C12-3h re-template (grid-cols-[1fr_auto]
      // with per-cell labels and stacked subtotal) is replaced by a compact
      // 5-track mobile grid: truncated name + qty + price + subtotal + trash,
      // all on ONE line (no wrapping, no horizontal overflow at 375px).
      expect(row.className).toContain("grid-cols-[minmax(0,1fr)_40px_64px_64px_40px]");
      expect(row.className).not.toContain("grid-cols-[1fr_auto]");
      // Desktop template unchanged.
      expect(row.className).toContain("lg:grid-cols-[2fr_60px_110px_110px_48px]");
    });
    // The mobile rows carry no per-cell labels anymore — the header row is
    // the single label source (visible at all breakpoints).
    const mobileLabels = container.querySelectorAll("label[for^='qty-'], label[for^='price-']");
    expect(mobileLabels.length).toBe(0);
    // Inputs keep their accessible names.
    const qtyInput = container.querySelector('input[id^="qty-"]');
    expect(qtyInput!.getAttribute("aria-label")).toContain("qty");
    // Compact numerals: the mobile inputs/text use text-xs below lg.
    expect(qtyInput!.className).toContain("max-lg:text-xs");
    expect(qtyInput!.className).toContain("max-lg:px-1!");
  });
});
