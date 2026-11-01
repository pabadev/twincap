// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MovementForm } from "./movement-form";
import type { SerializedAccount } from "../../../core/domain/account";
import type { SerializedCategory } from "../../../core/domain/category";

// Movement currency is determined by the selected account, never selected
// independently by the user.

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

// §15: mock the inline category form to avoid pulling in the real server action
// which requires env vars (MONGODB_URI, AUTH_SECRET).
vi.mock("../categories/category-form", () => ({
  CategoryForm: () => null,
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

function mountedForm(defaultAccountId?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MovementForm
        accounts={[account(), account({ id: "acc-2", name: "Dólares", currency: "USD" })]}
        categories={categories}
        defaultAccountId={defaultAccountId}
      />,
    );
  });
  return { container, unmount: () => root.unmount() };
}

function currencyInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[name="currency"]');
}

describe("MovementForm account currency", () => {
  it("derives currency from the selected account and has no currency selector", () => {
    const { container, unmount } = mountedForm();
    expect(container.querySelector('select[name="currency"]')).toBeNull();
    // Neutral account select (founder rule): the hidden currency starts empty
    // until the user picks an account.
    expect(currencyInput(container)?.value).toBe("");
    const accountSelect = container.querySelector<HTMLSelectElement>('select[name="accountId"]');
    expect(accountSelect).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setter.call(accountSelect!, "acc-1");
      accountSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(currencyInput(container)?.value).toBe("COP");
    expect(container.textContent).toContain("amount (COP)");
    unmount();
  });

  it("updates the currency when the account changes", () => {
    const { container, unmount } = mountedForm();
    const accountSelect = container.querySelector<HTMLSelectElement>('select[name="accountId"]');
    expect(accountSelect).not.toBeNull();
    act(() => {
      accountSelect!.value = "acc-2";
      accountSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(currencyInput(container)?.value).toBe("USD");
    expect(container.textContent).toContain("amount (USD)");
    unmount();
    unmount();
  });
});

// H-16 (fundador 2026-10-31): the alta REQUIRES an explicit movement context
// — a submitted-without-context movement is "neutral" and deliberately stays
// OUT of both scope tabs (would render Personales/Negocio incomplete).
describe("MovementForm context required (H-16)", () => {
  it("marks the context select as native-required to block empty submits", () => {
    const { container, unmount } = mountedForm();
    const contextSelect = container.querySelector<HTMLSelectElement>('select[name="context"]');
    expect(contextSelect).not.toBeNull();
    expect(contextSelect!.required).toBe(true);
    // The placeholder option carries an empty value so the browser's native
    // constraint blocks submits until a context is chosen.
    const placeholderOption = contextSelect!.options[0];
    expect(placeholderOption.value).toBe("");
    unmount();
  });

  it("keeps the server-side EXC-1 default available for non-UI callers", () => {
    // The movement DTO keeps `context?: MovementContext` (optional + 'Personal'
    // default server-side): the requirement lives in the UI layer only. The
    // action reads the field defensively (actions.ts isMovementContext guard).
    const { container, unmount } = mountedForm();
    const contextSelect = container.querySelector<HTMLSelectElement>('select[name="context"]');
    expect(contextSelect).not.toBeNull();
    // No preselected option value beyond the empty placeholder.
    expect(contextSelect!.selectedIndex).toBe(0);
    unmount();
    unmount();
  });
});
