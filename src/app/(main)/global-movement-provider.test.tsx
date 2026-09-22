// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalMovementProvider, useQuickMovement } from "./global-movement-provider";

// §16 regression: the FAB provider must invalidate its cached reference data
// (accounts/categories) when the modal closes, so a category created elsewhere
// appears immediately on the next open without a page refresh. Asserts the
// observable contract: one fetch per open, re-fetch after close+reopen.

vi.mock("../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

vi.mock("../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

const listAccountsAction = vi.fn().mockResolvedValue([]);
const listCategoriesAction = vi.fn().mockResolvedValue([]);

vi.mock("./movements/actions", () => ({
  listAccountsAction: (...args: unknown[]) => listAccountsAction(...args),
  listCategoriesAction: (...args: unknown[]) => listCategoriesAction(...args),
}));

const getSaleFormDataAction = vi.fn().mockResolvedValue({
  catalogItems: [],
  accounts: [],
  clients: [],
});

vi.mock("./pos/sales/actions", () => ({
  getSaleFormDataAction: (...args: unknown[]) => getSaleFormDataAction(...args),
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

// Stub the MovementForm to avoid pulling in server actions
vi.mock("./movements/movement-form", () => ({
  MovementForm: () => null,
}));

// Stub SaleForm — the POS modal reuses it (same fetch-on-open contract).
vi.mock("./pos/sales/sale-form", () => ({
  SaleForm: () => null,
}));

function TestConsumer() {
  const { openQuickMovement } = useQuickMovement();
  return (
    <button type="button" onClick={() => openQuickMovement()}>
      Open
    </button>
  );
}

const mounted: { unmount: () => void }[] = [];

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  const entry = { root, unmount: () => root.unmount() };
  mounted.push(entry);
  return { container, root, unmount: entry.unmount };
}

function unmountAll() {
  mounted.splice(0).forEach((entry) => entry.unmount());
}

describe("GlobalMovementProvider §16 cache invalidation", () => {
  afterEach(() => {
    unmountAll();
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders without crashing", () => {
    mount(
      <GlobalMovementProvider>
        <TestConsumer />
      </GlobalMovementProvider>,
    );
    unmountAll();
  });

  it("fetches fresh reference data on every open: 1 fetch per open-close-open cycle", async () => {
    const { container } = mount(
      <GlobalMovementProvider defaultCurrency="COP">
        <TestConsumer />
      </GlobalMovementProvider>,
    );
    const trigger = container.querySelector<HTMLButtonElement>("button")!;

    // First open → fetch reference data once.
    act(() => {
      trigger.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(listAccountsAction).toHaveBeenCalledTimes(1);
    expect(listCategoriesAction).toHaveBeenCalledTimes(1);

    // Close via the modal close button (cached data invalidated).
    const close = container.querySelector<HTMLButtonElement>('[aria-label="close"]')!;
    act(() => {
      close.click();
    });

    // Reopen → data was invalidated, so the provider fetches again.
    act(() => {
      trigger.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(listAccountsAction).toHaveBeenCalledTimes(2);
    expect(listCategoriesAction).toHaveBeenCalledTimes(2);
  });
});

// Beta feedback (B2): "Venta POS" must behave like Ingreso/Egreso — open the
// associated form in place (modal), not navigate away. Observable contract:
// the POS option opens a dialog whose data is fetched on open.
describe("GlobalMovementProvider POS sale in-place modal (B2)", () => {
  afterEach(() => {
    unmountAll();
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("opens the POS sale modal in place and fetches its data on open", async () => {
    const { container } = mount(
      <GlobalMovementProvider defaultCurrency="COP">
        <TestConsumer />
      </GlobalMovementProvider>,
    );

    // Open the speed dial and pick the POS option.
    const fab = container.querySelector<HTMLButtonElement>('[aria-label="quickAdd"]')!;
    act(() => {
      fab.click();
    });
    const posOption = container.querySelector<HTMLButtonElement>('[aria-label="quickAddPosSale"]')!;
    act(() => {
      posOption.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getSaleFormDataAction).toHaveBeenCalledTimes(1);
    // The POS dialog is open with the create-sale title (no navigation).
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("createSale");
  });

  it("invalidates cached POS data on close: re-fetch on the next open", async () => {
    const { container } = mount(
      <GlobalMovementProvider defaultCurrency="COP">
        <TestConsumer />
      </GlobalMovementProvider>,
    );

    const fab = container.querySelector<HTMLButtonElement>('[aria-label="quickAdd"]')!;
    act(() => {
      fab.click();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="quickAddPosSale"]')!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getSaleFormDataAction).toHaveBeenCalledTimes(1);

    // Close the POS modal, reopen the dial, pick POS again.
    const close = container.querySelector<HTMLButtonElement>('[aria-label="close"]')!;
    act(() => {
      close.click();
    });
    act(() => {
      fab.click();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="quickAddPosSale"]')!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getSaleFormDataAction).toHaveBeenCalledTimes(2);
  });
});
