import { describe, expect, it } from "vitest";
import { computeDashboardWindow } from "./compute-dashboard-window";

describe("computeDashboardWindow", () => {
  it("mid-year (Jul 15): from covers the previous civil year — Jan 1 2025, to Aug 1", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const { from, to } = computeDashboardWindow(now);
    // prevYearStart (§6/§5.1) = 2025-01-01 — always the most permissive bound.
    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("early year (Feb 15): prevYearStart (2025-01-01) wins", () => {
    const now = new Date("2026-02-15T12:00:00Z");
    const { from, to } = computeDashboardWindow(now);
    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("late year (Nov 20): from = Jan 1 2025", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const { from, to } = computeDashboardWindow(now);
    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("January (10): yearStart is already the prev civil year — from Jan 1 2025", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const { from, to } = computeDashboardWindow(now);
    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("tz offset crossing month boundary: UTC Mar 1 01:00 with offset +180 → civil Feb", () => {
    // getTimezoneOffset() convention: positive for west of UTC (UTC-3 → +180).
    // civilNow = 2026-03-01T01:00Z - 180min = 2026-02-28T22:00Z → civil month = Feb.
    const now = new Date("2026-03-01T01:00:00Z");
    const { from, to } = computeDashboardWindow(now, 180);
    // civil year = 2026 → prevYearStart = 2025-01-01
    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    // exclusive start of civil March = 2026-03-01Z
    expect(to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("tz offset crossing year boundary: UTC Jan 1 01:00 with offset +180 → civil Dec 31 2025", () => {
    // civilNow = 2026-01-01T01:00Z - 180min = 2025-12-31T22:00Z → civil year = 2025.
    const now = new Date("2026-01-01T01:00:00Z");
    const { from, to } = computeDashboardWindow(now, 180);
    // civil year = 2025 → prevYearStart = 2024-01-01
    expect(from.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    // exclusive start of civil Jan 2026 = 2026-01-01Z
    expect(to.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("from is always before to (invariant)", () => {
    const dates = [
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-06-15T12:30:00Z"),
      new Date("2026-12-31T23:59:59Z"),
      new Date("2025-03-01T08:00:00Z"),
    ];
    for (const now of dates) {
      const { from, to } = computeDashboardWindow(now);
      expect(from.getTime()).toBeLessThan(to.getTime());
    }
  });

  it("to is exclusive: a movement at exactly to falls outside { $gte: from, $lt: to }", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const { to } = computeDashboardWindow(now);
    expect(to.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    // $lt is strict: a movement at exactly `to` is NOT included.
    expect(to.getTime() < to.getTime()).toBe(false);
    expect(to.getTime() >= to.getTime()).toBe(true);
  });

  it("default tzOffsetMinutes is 0 (server UTC clock)", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const w1 = computeDashboardWindow(now);
    const w2 = computeDashboardWindow(now, 0);
    expect(w1.from.toISOString()).toBe(w2.from.toISOString());
    expect(w1.to.toISOString()).toBe(w2.to.toISOString());
  });
});
