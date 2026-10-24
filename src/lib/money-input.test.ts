import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./money-input";

// Beta feedback #13: money fields must tolerate Spanish-style typing without
// the silent reshaping the old type="number" inputs did ("5.000" → 5).
describe("parseMoneyInput", () => {
  it("parses plain digits (historical contract)", () => {
    expect(parseMoneyInput("5000")).toBe(5000);
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("treats strict thousands dot-groups as grouping (founder case)", () => {
    expect(parseMoneyInput("5.000")).toBe(5000);
    expect(parseMoneyInput("50.000")).toBe(50000);
    expect(parseMoneyInput("1.234.567")).toBe(1234567);
  });

  it("treats comma as the decimal separator (LatAm convention)", () => {
    expect(parseMoneyInput("5,50")).toBe(5.5);
    expect(parseMoneyInput("5000,50")).toBe(5000.5);
  });

  it("uses the LAST separator as decimal when both are present", () => {
    expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("1,234.56")).toBe(1234.56);
  });

  it("keeps a lone dot as a decimal point when it is not a group pattern", () => {
    expect(parseMoneyInput("5.50")).toBe(5.5);
    expect(parseMoneyInput("5.5")).toBe(5.5);
    expect(parseMoneyInput("5.0000")).toBe(5);
  });

  it("trims and ignores internal spaces", () => {
    expect(parseMoneyInput("  5000 ")).toBe(5000);
    expect(parseMoneyInput("1 500")).toBe(1500);
  });

  it("tolerates a leading minus (callers validate positivity)", () => {
    expect(parseMoneyInput("-500")).toBe(-500);
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("   ")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("5.0.0")).toBeNull();
    expect(parseMoneyInput("5a")).toBeNull();
  });
});
