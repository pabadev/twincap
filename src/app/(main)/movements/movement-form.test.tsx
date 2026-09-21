// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MovementForm } from "./movement-form";
import { DEFAULT_CURRENCY } from "../../../core/domain/currency";
import type { SerializedAccount } from "../../../core/domain/account";
import type { SerializedCategory } from "../../../core/domain/category";

// Ronda POST-UX §14/§42: the user's defaultCurrency must open the new-movement
// form with the right currency preselected. USD and BRL are both supported
// (BRL for PT-BR readiness); an absent preference falls back to DEFAULT_CURRENCY.

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

vi.mock("./actions", () => ({
  createMovementAction: vi.fn(async () => null),
  listAccountBalancesAction: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
    push: () => {},
    replace: () => {},
    back: () => {},
    prefetch: () => {},
  }),
}));

vi.mock("../../../lib/use-action-error", () => ({
  useActionError: () => (code: string) => code,
}));

vi.mock("../../../lib/use-money-action-confirmation", () => ({
  useMoneyActionConfirmation: () => ({
    shouldConfirm: false,
    confirm: () => Promise.resolve(true),
    modal: null,
  }),
}));

function account(overrides: Partial<SerializedAccount> = {}): SerializedAccount {
  return {
    id: "acc-1",
    name: "Cuenta",
    currency: "COP",
    balance: { amount: 0, currency: "COP" },
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as SerializedAccount;
}

const categories: SerializedCategory[] = [
  {
    id: "cat-1",
    name: "General",
    kind: "income" as never,
    workspaceId: "ws-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as unknown as SerializedCategory,
];

function mountedForm(defaultCurrency?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MovementForm
        accounts={[account()]}
        categories={categories}
        defaultCurrency={defaultCurrency}
      />,
    );
  });
  return { container, unmount: () => root.unmount() };
}

function currencySelect(container: HTMLElement): HTMLSelectElement | null {
  return container.querySelector('select[name="currency"]');
}

describe("MovementForm §14 defaultCurrency", () => {
  it("opens with USD when the user default is USD", () => {
    const { container } = mountedForm("USD");
    expect(currencySelect(container)?.value).toBe("USD");
    container.remove();
  });

  it("opens with BRL when the user default is BRL", () => {
    const { container } = mountedForm("BRL");
    expect(currencySelect(container)?.value).toBe("BRL");
    container.remove();
  });

  it("falls back to DEFAULT_CURRENCY (COP) when no preference exists", () => {
    const { container } = mountedForm(undefined);
    expect(currencySelect(container)?.value).toBe(DEFAULT_CURRENCY);
    container.remove();
  });
});
