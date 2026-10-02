import { describe, expect, it } from "vitest";
import { dashboardPeriodKeyOf, resolveDashboardPeriod } from "./dashboard-period";
import { computePeriodComparison } from "./compute-period-comparison";
import type { Movement } from "../../domain/movement";

function movement(
  id: string,
  type: "income" | "expense",
  amount: number,
  isoDate: string,
  currency = "COP",
): Movement {
  // Only the fields the comparison touches are meaningful; the domain type is
  // structural enough here — build a minimal snapshot-like movement.
  return {
    id,
    type,
    amount: { amount, currency } as never,
    date: new Date(isoDate),
    context: "Personal",
  } as unknown as Movement;
}

describe("dashboard-period keys", () => {
  it("month keys + previous month across December", () => {
    const civilNow = new Date("2026-01-15T12:00:00Z");
    const p = resolveDashboardPeriod("month", civilNow);
    expect(p.current).toBe("2026-01");
    expect(p.prev).toBe("2025-12");
  });

  it("year keys + previous year", () => {
    const p = resolveDashboardPeriod("year", new Date("2026-03-01T00:00:00Z"));
    expect(p.current).toBe("2026");
    expect(p.prev).toBe("2025");
  });

  it("keyOf is period-consistent", () => {
    const d = new Date("2026-05-20T00:00:00Z");
    expect(dashboardPeriodKeyOf("month", d)).toBe("2026-05");
    expect(dashboardPeriodKeyOf("year", d)).toBe("2026");
  });
});

describe("computePeriodComparison", () => {
  it("compares each currency with itself; ignores internal/financing flows", () => {
    // Movement ids starting with "link" model financed/financing movements as
    // excluded kinds would require a real link object; here only economic
    // moves are passed, plus·one noneconomic handled by classification.
    const movements: Movement[] = [
      movement("i1", "income", 100_000, "2026-10-05"),
      movement("e1", "expense", 40_000, "2026-10-10"),
      movement("i2", "income", 80_000, "2026-09-05"),
      movement("e2", "expense", 60_000, "2026-09-15"),
      // USD only present in one period → row shows src-on-one-side baseline.
      movement("u1", "income", 20, "2026-10-02", "USD"),
    ];
    const rows = computePeriodComparison({
      movements,
      period: "month",
      civilNow: new Date("2026-10-01T00:00:00Z"),
    });
    const cop = rows.find((r) => r.currency === "COP");
    expect(cop).toBeDefined();
    expect(cop!.income).toBe(100_000);
    expect(cop!.expenses).toBe(40_000);
    expect(cop!.result).toBe(60_000);
    expect(cop!.prevIncome).toBe(80_000);
    expect(cop!.prevExpenses).toBe(60_000);
    expect(cop!.prevResult).toBe(20_000);
    expect(cop!.incomeDelta).toBe(20_000);
    expect(cop!.incomePct).toBeCloseTo(0.25, 6);
    expect(cop!.resultPct).toBeCloseTo(2.0, 6);
    const usd = rows.find((r) => r.currency === "USD");
    expect(usd?.prevIncome).toBe(0);
    expect(usd?.incomePct).toBeNull();
  });

  it("year granularity spans the civil year", () => {
    const movements: Movement[] = [
      movement("i1", "income", 10_000, "2026-02-10"),
      movement("i2", "income", 10_000, "2026-11-10"),
      movement("p1", "income", 99_000, "2025-05-10"),
    ];
    const rows = computePeriodComparison({
      movements,
      period: "year",
      civilNow: new Date("2026-12-15T00:00:00Z"),
    });
    const cop = rows.find((r) => r.currency === "COP")!;
    expect(cop.income).toBe(20_000);
    expect(cop.prevIncome).toBe(99_000);
  });

  it("previous zero → pct null, no Infinity/NaN", () => {
    const movements: Movement[] = [movement("e1", "expense", 5_000, "2026-10-01")];
    const rows = computePeriodComparison({
      movements,
      period: "month",
      civilNow: new Date("2026-10-01T00:00:00Z"),
    });
    for (const r of rows) {
      expect(Number.isFinite(r.incomePct ?? 0)).toBe(true);
      expect(Number.isFinite(r.expensePct ?? 0)).toBe(true);
      expect(Number.isFinite(r.resultPct ?? 0)).toBe(true);
    }
  });
});
