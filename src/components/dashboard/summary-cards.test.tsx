// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryCards } from "./summary-cards";
import type { PeriodComparisonRow } from "../../core/application/dashboard/compute-period-comparison";

// (jsdom + createRoot pattern of the repo — no testing-library.)
vi.mock("../../i18n/client", () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (!params) return key;
    return `${key} ${JSON.stringify(params)}`;
  },
  useLocale: () => "es",
}));

let mounts: Array<{ root: Root; container: HTMLElement }> = [];

async function renderNode(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  mounts.push({ root, container });
  return container;
}

afterEach(async () => {
  for (const { root, container } of mounts) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
  mounts = [];
});

// Zero amounts must never render with a caller sign modifier ("−0 COP"):
// zero is neither income nor expense (founder screenshot report 2026-10-02).
describe("SummaryCards zero-sign contract", () => {
  it("suppresses the caller sign on zero amounts", async () => {
    const container = await renderNode(
      <SummaryCards
        currency="COP"
        monthlyIncome={0}
        monthlyExpenses={0}
        financingInflow={0}
        financingOutflow={0}
        locale="es"
      />,
    );
    expect(container.textContent).not.toMatch(/−\s?0/);
    expect(container.textContent).not.toMatch(/-\s?0/);
  });
});

// Founder rule (2026-10-02): when NOTHING but the default currency has
// movements in the selected current period, the comparison indicators render
// ONLY the default currency — a segment for a currency the user did not move
// this period (previous-period-only rows) is confusing noise.
function compareRow(
  currency: string,
  over: Partial<PeriodComparisonRow> = {},
): PeriodComparisonRow {
  return {
    currency,
    income: 0,
    expenses: 0,
    result: 0,
    prevIncome: 0,
    prevExpenses: 0,
    prevResult: 0,
    incomeDelta: 0,
    expenseDelta: 0,
    resultDelta: 0,
    incomePct: null,
    expensePct: null,
    resultPct: null,
    ...over,
  };
}

describe("Period comparison currency filter (founder rule)", () => {
  it("shows ONLY the default currency when other currencies have no current-period movements", async () => {
    // USD had movements ONLY in the previous period — no current data at all.
    const container = await renderNode(
      <SummaryCards
        currency="COP"
        monthlyIncome={50000}
        monthlyExpenses={20000}
        financingInflow={0}
        financingOutflow={0}
        locale="es"
        period="month"
        periodComparison={[
          compareRow("COP", {
            income: 50000,
            expenses: 20000,
            result: 30000,
            prevIncome: 40000,
            prevExpenses: 15000,
            prevResult: 25000,
            incomeDelta: 10000,
            expenseDelta: 5000,
            resultDelta: 5000,
            incomePct: 0.25,
            expensePct: 2000 / 15000,
            resultPct: 5000 / 25000,
          }),
          compareRow("USD", {
            prevIncome: 100,
            prevResult: 100,
            incomeDelta: -100,
            resultDelta: -100,
          }),
        ]}
      />,
    );
    const text = container.textContent;
    // COP segment (income pct) IS rendered.
    expect(text).toContain("25%");
    expect(text).toContain("prevCompareFull");
    // The USD previous-period-only row is NOT rendered as a visible segment.
    expect(text).not.toContain("～");
    expect(text).not.toContain("prevCompareNoRefFull");
  });

  it("keeps every currency segment when another currency IS active this period", async () => {
    const container = await renderNode(
      <SummaryCards
        currency="COP"
        monthlyIncome={505}
        monthlyExpenses={0}
        financingInflow={0}
        financingOutflow={0}
        locale="es"
        period="month"
        periodComparison={[
          compareRow("COP", {
            income: 40000,
            prevIncome: 30000,
            incomeDelta: 10000,
            incomePct: 0.25,
          }),
          compareRow("USD", { income: 500, incomeDelta: 500, resultDelta: 500 }),
        ]}
      />,
    );
    const text = container.textContent;
    expect(text).toContain("25%");
    expect(text).toContain("～");
    expect(text).toContain("prevCompareNoRefFull");
  });

  it("renders no segments when even the default currency has no comparable data", async () => {
    const container = await renderNode(
      <SummaryCards
        currency="COP"
        monthlyIncome={0}
        monthlyExpenses={0}
        financingInflow={0}
        financingOutflow={0}
        locale="es"
        period="month"
        periodComparison={[]}
      />,
    );
    expect(container.textContent).not.toContain("～");
    expect(container.textContent).not.toContain("prevCompare");
  });
});
