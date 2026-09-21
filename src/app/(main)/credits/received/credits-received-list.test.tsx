// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditsReceivedList } from "./credits-received-list";
import type { SerializedCreditReceived } from "../../../../core/domain/credit-received";

// Ronda POST-UX §19/§20: the credit card header must stack into rows on
// mobile (counterparty / metadata / amounts+actions) instead of squeezing
// three columns side by side; desktop keeps the single-row layout.

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

describe("CreditsReceivedList card header responsiveness (§19/§20)", () => {
  it("stacks the card header on mobile and restores the row layout on sm+", () => {
    const { container } = mount(<CreditsReceivedList accounts={accounts} credits={[credit]} />);
    const header = container.querySelector<HTMLElement>("div.cursor-pointer");
    expect(header).not.toBeNull();
    // Mobile: column stack with row gaps; desktop: back to the single row.
    expect(header!.className).toContain("flex-col");
    expect(header!.className).toContain("sm:flex-row");
    // The amounts+actions group spreads across the card width on mobile and
    // packs to the right edge on desktop.
    const bottomRow = header!.lastElementChild as HTMLElement | null;
    expect(bottomRow?.className).toContain("justify-between");
    expect(bottomRow?.className).toContain("sm:justify-end");
    // The counterparty block cannot force horizontal overflow.
    expect(container.querySelector("span.min-w-0")).not.toBeNull();
  });

  it("keeps the amounts and pending figure visible in the stacked row", () => {
    const { container } = mount(<CreditsReceivedList accounts={accounts} credits={[credit]} />);
    const header = container.querySelector<HTMLElement>("div.cursor-pointer")!;
    const bottomRow = header.lastElementChild!;
    // Principal on top, pending below — both inside the mobile row.
    expect(bottomRow.textContent).toContain("pending");
  });
});
