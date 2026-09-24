// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaleForm } from "./sale-form";
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

vi.mock("../catalog/catalog-form", () => ({
  CatalogForm: () => null,
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
    const gridWrapper = form!.querySelector(
      ".lg\\:grid.lg\\:grid-cols-\\[minmax\\(0\\2c 1fr\\)_20rem\\]",
    );
    expect(gridWrapper).not.toBeNull();
  });

  it("places the line items section (search + table) in the left column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const cartSection = container.querySelector(".lg\\:col-start-1.lg\\:row-start-1");
    expect(cartSection).not.toBeNull();
    // The search combobox lives inside the cart section.
    expect(cartSection!.querySelector("#item-search")).not.toBeNull();
    // The "createNewItem" link lives inside the cart section.
    const createItemBtn = [...cartSection!.querySelectorAll("button")].find(
      (b) => b.textContent === "createNewItem",
    );
    expect(createItemBtn).toBeDefined();
  });

  it("places the settings section (payment, client, date) in the right column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const settingsSection = container.querySelector(".lg\\:col-start-2.lg\\:row-start-1");
    expect(settingsSection).not.toBeNull();
    expect(settingsSection!.querySelector("#paymentMode")).not.toBeNull();
    expect(settingsSection!.querySelector("#clientId")).not.toBeNull();
    expect(settingsSection!.querySelector("#date")).not.toBeNull();
  });

  it("places the summary + actions in a sticky bottom section at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const summarySection = container.querySelector(
      ".lg\\:col-start-2.lg\\:row-start-2.lg\\:sticky",
    );
    expect(summarySection).not.toBeNull();
    expect(summarySection!.textContent).toContain("total");
    const submitBtn = [...summarySection!.querySelectorAll("button")].find(
      (b) => b.type === "submit",
    );
    expect(submitBtn).toBeDefined();
  });

  it("renders the total amount in the sticky summary section", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add an item so the total is non-zero.
    selectFromSearch(container, 0);
    const summarySection = container.querySelector(".lg\\:col-start-2.lg\\:row-start-2");
    expect(summarySection!.textContent).toContain("total");
    // Total = 1 item × qty 1 × unitPrice 1000 = 1000 COP.
    expect(summarySection!.textContent).toContain("1000");
  });

  it("preserves mobile DOM order: cart → settings → summary", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const gridWrapper = container.querySelector(
      ".lg\\:grid.lg\\:grid-cols-\\[minmax\\(0\\2c 1fr\\)_20rem\\]",
    );
    expect(gridWrapper).not.toBeNull();
    const children = Array.from(gridWrapper!.children);
    expect(children.length).toBe(3);
    // First child: cart (contains search combobox)
    expect(children[0].querySelector("#item-search")).not.toBeNull();
    // Second child: settings (contains #paymentMode)
    expect(children[1].querySelector("#paymentMode")).not.toBeNull();
    // Third child: summary (contains submit button)
    const submitBtn = children[2].querySelector('button[type="submit"]');
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
    // The header row is hidden on mobile (hidden class) but present in DOM.
    const headerRow = container.querySelector(
      ".hidden.items-center.gap-2.border-b.border-surface-border.pb-2.text-xs.font-medium.text-zinc-600.lg\\:flex",
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
    expect(hint!.className).toMatch(/text-amber-(400|600)/);
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
