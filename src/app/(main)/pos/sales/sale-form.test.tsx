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

// Ronda POST-UX §23: the line-item remove control must be icon-only with an
// accessible name and native tooltip (no visible text label).
describe("SaleForm remove-item control (§23)", () => {
  it("renders an icon-only remove button with accessible name and tooltip", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // A single line item has no remove control yet.
    expect(container.querySelector('button[aria-label="remove"]')).toBeNull();

    const addItem = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    expect(addItem).toBeDefined();
    act(() => {
      addItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

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

// A1 (F3): line-item row must have min-w-0 on the item-name flex child to
// prevent overflow inside the modal budget.
describe("SaleForm line-item row overflow (A1 F3)", () => {
  it("renders the item-name cell with min-w-0 to allow text truncation", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // The first flex child inside each line-item row is the item-name cell.
    const row = container.querySelector(".flex.flex-wrap.items-end");
    expect(row).not.toBeNull();
    const firstChild = row!.firstElementChild as HTMLElement;
    expect(firstChild.className).toContain("min-w-0");
  });
});

// C12-1: close-guard — unsaved changes must trigger a confirmation before
// discarding. The dirty flag is exposed via dirtyRef so the parent can read it
// synchronously in the close handler (no stale closures).
describe("SaleForm dirty tracking (C12-1)", () => {
  it("starts clean: dirtyRef is false on mount with default values", () => {
    const dirtyRef = { current: false };
    mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    expect(dirtyRef.current).toBe(false);
  });

  it("becomes dirty when the user adds a line item", () => {
    const dirtyRef = { current: false };
    const { container } = mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    const addItem = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    expect(addItem).toBeDefined();
    act(() => {
      addItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
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

  it("stays clean when the preselected line item is untouched", () => {
    const dirtyRef = { current: false };
    mount(<SaleForm {...baseProps} dirtyRef={dirtyRef} />);
    // The first line item is preselected from the catalog — not a user edit.
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
describe("SaleForm responsive layout (C12-3)", () => {
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

  it("places the line items section in the left column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // The line items section contains the "addItem" button and the item selects.
    const cartSection = container.querySelector(".lg\\:col-start-1.lg\\:row-start-1");
    expect(cartSection).not.toBeNull();
    expect(cartSection!.querySelector("button")).not.toBeNull();
    // The "addItem" button lives inside the cart section.
    const addItemBtn = [...cartSection!.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    expect(addItemBtn).toBeDefined();
  });

  it("places the settings section (payment, client, date) in the right column at lg+", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const settingsSection = container.querySelector(".lg\\:col-start-2.lg\\:row-start-1");
    expect(settingsSection).not.toBeNull();
    // Payment mode select lives inside the settings section.
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
    // The total text and the submit button live inside the summary section.
    expect(summarySection!.textContent).toContain("total");
    const submitBtn = [...summarySection!.querySelectorAll("button")].find(
      (b) => b.type === "submit",
    );
    expect(submitBtn).toBeDefined();
  });

  it("renders the total amount in the sticky summary section", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const summarySection = container.querySelector(".lg\\:col-start-2.lg\\:row-start-2");
    // Total = 1 item × qty 1 × unitPrice 1000 = 1000 COP.
    expect(summarySection!.textContent).toContain("total");
    expect(summarySection!.textContent).toContain("1000");
  });

  it("preserves mobile DOM order: cart → settings → summary (C12-3b flow)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const gridWrapper = container.querySelector(
      ".lg\\:grid.lg\\:grid-cols-\\[minmax\\(0\\2c 1fr\\)_20rem\\]",
    );
    expect(gridWrapper).not.toBeNull();
    const children = Array.from(gridWrapper!.children);
    expect(children.length).toBe(3);
    // First child: cart (contains addItem button) — C12-3b: articles first
    const addItemBtn = [...children[0].querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    expect(addItemBtn).toBeDefined();
    // Second child: settings (contains #paymentMode)
    expect(children[1].querySelector("#paymentMode")).not.toBeNull();
    // Third child: summary (contains submit button)
    const submitBtn = children[2].querySelector('button[type="submit"]');
    expect(submitBtn).not.toBeNull();
  });
});

// C12-3b: visual hierarchy refinements — desktop table layout, action hierarchy,
// numeric formatting, and styling improvements.
describe("SaleForm visual hierarchy (C12-3b)", () => {
  it("renders a desktop header row with column labels (hidden on mobile)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // The header row is hidden on mobile (hidden class) but present in DOM.
    const headerRow = container.querySelector(
      ".hidden.items-center.gap-2.border-b.border-surface-border.pb-2.text-xs.font-medium.text-zinc-600.lg\\:flex",
    );
    expect(headerRow).not.toBeNull();
    // Header contains column labels: item, qty, unitPrice, subtotal
    expect(headerRow!.textContent).toContain("item");
    expect(headerRow!.textContent).toContain("qty");
    expect(headerRow!.textContent).toContain("unitPrice");
    expect(headerRow!.textContent).toContain("subtotal");
  });

  it("renders subtotal column per line item on desktop (hidden on mobile)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add a second line item to test multiple rows
    const addItem = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    act(() => {
      addItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Subtotal columns are hidden on mobile (hidden class) but present in DOM.
    const subtotalCells = container.querySelectorAll(
      ".hidden.w-24.text-right.text-sm.text-zinc-700.sm\\:block.sm\\:w-28",
    );
    expect(subtotalCells.length).toBe(2); // One per line item
  });

  it("renders delete button with neutral base styling (red on hover)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Add a second line item to show the delete button
    const addItem = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    act(() => {
      addItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const removeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="remove"]');
    expect(removeBtn).not.toBeNull();
    // Base styling: neutral gray (text-zinc-400 or text-zinc-500), not danger
    expect(removeBtn!.className).toMatch(/text-zinc-(400|500)/);
    // Hover styling: danger red (hover:text-danger)
    expect(removeBtn!.className).toContain("hover:text-danger");
  });

  it("renders 'Agregar artículo' as a secondary button (not a text link)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const addItemBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "addItem",
    );
    expect(addItemBtn).toBeDefined();
    // Secondary button has variant="secondary" classes
    expect(addItemBtn!.className).toContain("bg-zinc-100");
    expect(addItemBtn!.className).toContain("text-zinc-700");
  });

  it("renders 'Crear artículo' as a discreet text link (not competing with Agregar)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const createItemBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "createItem",
    );
    expect(createItemBtn).toBeDefined();
    // Discreet link styling: small text, muted color, not a filled button
    expect(createItemBtn!.className).toContain("text-xs");
    expect(createItemBtn!.className).toMatch(/text-zinc-(400|500)/);
    // Should NOT have button variant classes (bg-primary, bg-zinc-100, etc.)
    expect(createItemBtn!.className).not.toContain("bg-primary");
    expect(createItemBtn!.className).not.toContain("bg-zinc-100");
  });

  it("renders unit price input as text type with inputMode decimal (format-on-blur)", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(priceInput).not.toBeNull();
    // C12-3b: changed from type="number" to type="text" with inputMode="decimal"
    // to support format-on-blur with thousands separators.
    expect(priceInput!.type).toBe("text");
    expect(priceInput!.getAttribute("inputmode")).toBe("decimal");
  });

  it("right-aligns numeric inputs (quantity, unit price) for fast scanning", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    const qtyInput = container.querySelector<HTMLInputElement>('input[id^="qty-"]');
    const priceInput = container.querySelector<HTMLInputElement>('input[id^="price-"]');
    expect(qtyInput).not.toBeNull();
    expect(priceInput).not.toBeNull();
    // Both numeric inputs have text-right class
    expect(qtyInput!.className).toContain("text-right");
    expect(priceInput!.className).toContain("text-right");
  });

  it("applies warning tint to credit-mode client hint when client is missing", () => {
    const { container } = mount(<SaleForm {...baseProps} />);
    // Switch to credit mode
    switchPaymentMode(container, "on-credit");
    // The hint should have warning styling (amber tint)
    const hint = container.querySelector<HTMLElement>("#clientId-hint");
    expect(hint).not.toBeNull();
    expect(hint!.className).toMatch(/text-amber-(400|600)/);
    expect(hint!.className).toContain("font-medium");
  });
});
