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

  it("preserves mobile DOM order: cart → settings → footer", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const form = container.querySelector("form");
    // C12-3e: form contains grid wrapper + footer. Grid wrapper contains cart + settings.
    const gridWrapper = form!.querySelector(".lg\\:grid.lg\\:grid-cols-\\[1fr_320px\\]");
    expect(gridWrapper).not.toBeNull();
    const gridChildren = Array.from(gridWrapper!.children);
    expect(gridChildren.length).toBe(2);
    // First child: cart (contains search combobox)
    expect(gridChildren[0].querySelector("#item-search")).not.toBeNull();
    // Second child: settings (contains #paymentMode)
    expect(gridChildren[1].querySelector("#paymentMode")).not.toBeNull();
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
  it("renders a desktop header row with column labels (hidden on mobile)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add an item so the table renders.
    selectFromSearch(container, 0);
    // C12-3e: the header row is hidden on mobile (hidden class) but present in DOM.
    // It's outside the scroll container (not sticky) and uses grid layout.
    const headerRow = container.querySelector(
      ".hidden.shrink-0.border-b.border-surface-border.pb-2.text-xs.font-medium.text-zinc-600.lg\\:grid",
    );
    expect(headerRow).not.toBeNull();
    expect(headerRow!.textContent).toContain("item");
    expect(headerRow!.textContent).toContain("qty");
    expect(headerRow!.textContent).toContain("unitPrice");
    expect(headerRow!.textContent).toContain("subtotal");
    expect(headerRow!.textContent).toContain("actions");
  });

  it("renders subtotal as formatted text (not an input) right-aligned", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    // Subtotal cells are hidden on mobile (hidden class) but present in DOM.
    const subtotalCells = container.querySelectorAll(
      ".hidden.w-24.text-right.text-sm.text-zinc-700.sm\\:block.sm\\:w-28",
    );
    expect(subtotalCells.length).toBe(1);
    // The subtotal is formatted text, not an input.
    expect(subtotalCells[0].querySelector("input")).toBeNull();
    // Contains the formatted amount (1 × 1000 = 1000 COP).
    expect(subtotalCells[0].textContent).toContain("1000");
  });

  it("renders delete button with neutral base styling (red on hover)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const removeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="remove"]');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn!.className).toMatch(/text-zinc-(400|500)/);
    expect(removeBtn!.className).toContain("hover:text-danger");
  });

  it("renders 'createNewItem' as a discreet text link (not a filled button)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const createItemBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "createNewItem",
    );
    expect(createItemBtn).toBeDefined();
    expect(createItemBtn!.className).toContain("text-xs");
    expect(createItemBtn!.className).toMatch(/text-zinc-(400|500)/);
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

  it("right-aligns numeric inputs (quantity, unit price) for fast scanning", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    const qtyInput = container.querySelector<HTMLInputElement>('input[id^="qty-"]');
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(qtyInput).not.toBeNull();
    expect(priceInput).not.toBeNull();
    expect(qtyInput!.className).toContain("text-right");
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
    const subtotalCells = container.querySelectorAll(
      ".hidden.w-24.text-right.text-sm.text-zinc-700.sm\\:block.sm\\:w-28",
    );
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

    // The row must show the item name (not empty/undefined).
    // Desktop: plain text in table cell. Mobile: title text.
    const nameTexts = container.querySelectorAll(".min-w-0.truncate");
    expect(nameTexts.length).toBe(1);
    expect(nameTexts[0].textContent).toBe("New Item");
    expect(nameTexts[0].textContent).not.toContain("undefined");

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
    const subtotalCells = container.querySelectorAll(
      ".hidden.w-24.text-right.text-sm.text-zinc-700.sm\\:block.sm\\:w-28",
    );
    expect(subtotalCells.length).toBe(1);
    expect(subtotalCells[0].textContent).toContain("5000");
    expect(subtotalCells[0].textContent).toContain("COP");
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

  it("desktop table header is outside the scroll container (not sticky)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    selectFromSearch(container, 0);
    // C12-3e: the header is a sibling of the rows container, not inside it.
    // It's hidden on mobile and uses grid layout on desktop.
    const tableWrapper = container.querySelector('[data-testid="table-wrapper"]');
    expect(tableWrapper).not.toBeNull();
    const headerRow = tableWrapper!.querySelector(".hidden.shrink-0.lg\\:grid");
    expect(headerRow).not.toBeNull();
    // The header is NOT inside the scroll container.
    const rowsContainer = tableWrapper!.querySelector('[data-testid="table-rows-container"]');
    expect(rowsContainer!.contains(headerRow!)).toBe(false);
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

  it("form root fills modal body on desktop (h-full)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const root = container.querySelector("form")!.parentElement;
    expect(root).not.toBeNull();
    expect(root!.className).toContain("h-full");
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
    // C12-3f: workspace variant sets lg:h-[85vh] and lg:w-[92vw] lg:max-w-[1080px].
    expect(dialog!.className).toContain("lg:h-[85vh]");
    expect(dialog!.className).toContain("lg:w-[92vw]");
    expect(dialog!.className).toContain("lg:max-w-[1080px]");
  });

  it("body wrapper has min-h-0 chain for flex/grid sizing", () => {
    const { container } = mountWithModal(<SaleForm {...baseProps} />);
    // The body wrapper is the modal-body-workspace element.
    const bodyWrapper = container.querySelector('[data-testid="modal-body-workspace"]');
    expect(bodyWrapper).not.toBeNull();
    expect(bodyWrapper!.className).toContain("min-h-0");
    expect(bodyWrapper!.className).toContain("flex-1");
    expect(bodyWrapper!.className).toContain("overflow-hidden");
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
    // The table header row must be a sibling of the rows container (not inside it).
    const tableWrapper = container.querySelector('[data-testid="table-wrapper"]');
    const tableHeader = tableWrapper!.querySelector(".hidden.shrink-0.lg\\:grid");
    expect(tableHeader).not.toBeNull();
    expect(rowsContainer!.contains(tableHeader!)).toBe(false);
  });
});
