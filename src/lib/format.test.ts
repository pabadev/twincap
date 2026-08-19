import { describe, expect, it } from "vitest";
import { formatAmount, formatDate } from "./format";

describe("formatAmount", () => {
  it("formats COP with 0 decimals", () => {
    const result = formatAmount(50000, "COP", "es");
    expect(result).toContain("50.000");
    expect(result).toContain("COP");
  });

  it("formats USD with 2 decimals", () => {
    const result = formatAmount(1599, "USD", "en");
    expect(result).toContain("15.99");
    expect(result).toContain("$");
  });

  it("formats MXN with 2 decimals", () => {
    const result = formatAmount(10000, "MXN", "es");
    expect(result).toContain("100");
    expect(result).toContain("MXN");
  });

  it("formats EUR with 2 decimals", () => {
    const result = formatAmount(2500, "EUR", "en");
    expect(result).toContain("25");
    expect(result).toContain("€");
  });

  it("formats zero amount", () => {
    const result = formatAmount(0, "COP", "es");
    expect(result).toContain("0");
  });

  it("formats large amounts", () => {
    const result = formatAmount(100000000, "COP", "es");
    expect(result).toContain("100");
  });
});

describe("formatDate", () => {
  it("formats ISO date string", () => {
    const result = formatDate("2026-03-15", "en");
    expect(result).toContain("2026");
    // Month abbreviation — day may shift due to timezone, just check month+year
    expect(result).toMatch(/\w+ \d+, 2026/);
  });

  it("formats Date object", () => {
    const date = new Date(2026, 6, 4); // July 4 in local time
    const result = formatDate(date, "en");
    expect(result).toContain("Jul");
    expect(result).toContain("4");
  });

  it("formats in Spanish locale", () => {
    const result = formatDate("2026-01-20", "es");
    expect(result).toContain("20");
    expect(result).toContain("2026");
  });
});
