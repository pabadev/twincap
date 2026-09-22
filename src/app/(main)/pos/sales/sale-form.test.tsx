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
    const optionValues = Array.from(clientSelect!.querySelectorAll("option")).map(
      (o) => o.value,
    );
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
