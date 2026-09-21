// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditsReceivedList } from "./credits-received-list";
import type { SerializedCreditReceived } from "../../../../core/domain/credit-received";

// Ronda POST-UX beta feedback (B4): the collapsed credit card must follow the
// Movements card format — row 1 identity + chevron, label/value rows for the
// financial data, and a bordered footer with the abono count + actions.

vi.mock("../../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

// Interactive children are irrelevant to the header layout semantics.
vi.mock("./credit-form", () => ({ CreditForm: () => null }));
vi.mock("./abono-form", () => ({ AbonoForm: () => null }));
vi.mock("./edit-abono-form", () => ({ EditAbonoForm: () => null }));
vi.mock("./edit-credit-form", () => ({ EditCreditForm: () => null }));
vi.mock("./delete-credit-button", () => ({ DeleteCreditButton: () => null }));
vi.mock("./delete-abono-button", () => ({ DeleteAbonoButton: () => null }));
vi.mock("./mark-as-paid-button", () => ({ MarkAsPaidButton: () => null }));
vi.mock("../../../../components/ui/modal", () => ({ Modal: () => null }));

const credit: SerializedCreditReceived = {
  id: "cr1",
  workspaceId: "ws-1",
  counterparty: "Banco Ejemplo",
  principal: { amount: 1000000, currency: "COP" },
  accountId: "a1",
  date: new Date("2026-09-01T12:00:00.000Z"),
  installments: undefined,
  frequency: undefined,
  installmentValue: undefined,
  totalToPay: 1000000,
  createdAt: new Date(0),
  version: 1,
  pending: 500000,
  abonos: [],
};

const accounts: never[] = [];

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

describe("CreditsReceivedList card format (B4)", () => {
  it("renders identity row, label/value rows and a bordered footer", () => {
    const { container } = mount(<CreditsReceivedList accounts={accounts} credits={[credit]} />);
    const header = container.querySelector<HTMLElement>("div.cursor-pointer");
    expect(header).not.toBeNull();
    // Row 1 carries the counterparty and the expand chevron.
    expect(header!.textContent).toContain(credit.counterparty);
    expect(header!.querySelector("svg")).not.toBeNull();
    // The financial data lives in dl label/value rows (date, amount, pending).
    const dl = header!.querySelector("dl");
    expect(dl).not.toBeNull();
    expect(dl!.textContent).toContain("date");
    expect(dl!.textContent).toContain("amount");
    expect(dl!.textContent).toContain("pending");
    // Footer is a bordered sibling row with the abono count and edit action.
    const footer = header!.nextElementSibling as HTMLElement | null;
    expect(footer?.className).toContain("border-t");
    expect(footer!.textContent).toContain("abonoCount");
    expect(footer!.querySelector('button[aria-label="edit"]')).not.toBeNull();
  });

  it("keeps the pending figure visible and emphasized in the rows", () => {
    const { container } = mount(<CreditsReceivedList accounts={accounts} credits={[credit]} />);
    const dl = container.querySelector("dl")!;
    const pendingRow = [...dl.querySelectorAll("dd")].find((dd) =>
      dd.className.includes("text-debt"),
    );
    expect(pendingRow).toBeDefined();
    expect(pendingRow!.className).toContain("tabular-nums");
  });
});
