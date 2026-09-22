// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardContent } from "./dashboard-content";
import type { DashboardSnapshot } from "./dashboard-snapshot";

// UX-9 Slice D, R-9/R-10a (H-18): the chart view toggles (Mensual/Anual)
// expose their state via aria-pressed and each sits inside a TouchTarget with
// a >=44px hit area. Scenarios S9.1, S9.2, S9.3.

vi.mock("../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

const mockSnapshot: DashboardSnapshot = {
  filters: { scope: "all", accountId: "all", categoryId: "all" },
  currency: "COP",
  accountBalances: [],
  currencyBreakdown: [],
  monthlyIncome: 0,
  monthlyExpenses: 0,
  financingInflow: 0,
  financingOutflow: 0,
  financingBreakdown: [],
  incomeRows: [],
  expenseRows: [],
  incomeTotals: [],
  expenseTotals: [],
  monthlyData: [],
  yearlyData: [],
  recentMovements: [],
  dataAsOf: "2026-09-16",
  attentionTotals: [],
  overduePayables: [],
};

vi.mock("../../app/(main)/dashboard/actions", () => ({
  getDashboardSnapshotAction: vi.fn(async () => mockSnapshot),
}));

// Presentational children are irrelevant to the toggle semantics; stubbed so
// the render stays stable and focused on the N3 header controls (S9.x).
vi.mock("./dashboard-filters", () => ({ DashboardFilterBar: () => null }));
vi.mock("./summary-cards", () => ({ SummaryCards: () => null }));
vi.mock("./summary-hero", () => ({ SummaryHero: () => null }));
vi.mock("./summary-attention", () => ({ SummaryAttention: () => null }));
vi.mock("./monthly-chart", () => ({ MonthlyChart: () => null }));
vi.mock("./recent-movements", () => ({ RecentMovements: () => null }));
vi.mock("./position-cards", () => ({ PositionCards: () => null }));
vi.mock("./dashboard-reports-grid", () => ({ DashboardReportsGrid: () => null }));
vi.mock("./summary-table", () => ({ SummaryTable: () => null }));
vi.mock("../feedback/feedback-widget", () => ({ FeedbackDialog: () => null }));

const baseProps = {
  accounts: [],
  categories: [],
  primaryCurrency: "COP",
  locale: "es",
  userLabel: "User",
  noAccountsMessage: "noAccounts",
  noMovementsMessage: "noMovements",
  positionData: [],
  initialSnapshot: mockSnapshot,
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

function toggleButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label),
  );
  if (!button) throw new Error(`toggle button "${label}" not found`);
  return button as HTMLButtonElement;
}

describe("DashboardContent chart toggles (R-9/R-10a, H-18)", () => {
  it("marks the monthly toggle pressed when chartView is monthly (S9.1)", () => {
    const { container } = mount(<DashboardContent {...baseProps} />);
    expect(toggleButton(container, "viewMonthly").getAttribute("aria-pressed")).toBe("true");
    expect(toggleButton(container, "viewYearly").getAttribute("aria-pressed")).toBe("false");
  });

  it("inverts aria-pressed when the yearly toggle is clicked (S9.2)", () => {
    const { container } = mount(<DashboardContent {...baseProps} />);
    act(() => {
      toggleButton(container, "viewYearly").click();
    });
    expect(toggleButton(container, "viewMonthly").getAttribute("aria-pressed")).toBe("false");
    expect(toggleButton(container, "viewYearly").getAttribute("aria-pressed")).toBe("true");
  });

  it("wraps both toggles in a TouchTarget with a >=44px hit area (S9.3)", () => {
    const { container } = mount(<DashboardContent {...baseProps} />);
    for (const label of ["viewMonthly", "viewYearly"]) {
      const target = toggleButton(container, label).querySelector("span");
      expect(target).not.toBeNull();
      expect(target?.className).toContain("min-h-[44px]");
      expect(target?.className).toContain("min-w-[44px]");
    }
  });
});

// Ronda POST-UX §21: an extremely large account balance must stay visible
// inside its card (the Card root clips overflow) — wrapping with aligned
// digits, never truncated or hidden.
describe("DashboardContent account balance overflow (§21)", () => {
  it("renders very large balances with break-words and tabular-nums", async () => {
    const bigBalanceSnapshot = {
      ...mockSnapshot,
      accountBalances: [
        {
          id: "a1",
          name: "Checking",
          currency: "COP",
          isFixed: false,
          balance: 99999999999999,
        },
      ],
    };
    const { getDashboardSnapshotAction } = await import("../../app/(main)/dashboard/actions");
    vi.mocked(getDashboardSnapshotAction).mockResolvedValue(bigBalanceSnapshot);

    const { container } = mount(
      <DashboardContent {...baseProps} initialSnapshot={bigBalanceSnapshot} />,
    );
    const balanceSpan = container.querySelector<HTMLElement>(".tabular-nums");
    expect(balanceSpan).not.toBeNull();
    expect(balanceSpan!.className).toContain("break-words");
    expect(balanceSpan!.className).toContain("min-w-0");
    // The full figure is present in the DOM (nothing hidden/clipped away).
    expect(balanceSpan!.textContent).toContain("99");
  });
});
