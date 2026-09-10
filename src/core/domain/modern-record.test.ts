import { describe, expect, it } from "vitest";
import { isModernRecord, R15_1_MODERN_CUTOFF } from "./modern-record";

describe("isModernRecord (R15.1)", () => {
  it("treats a record created exactly at the cutoff as modern (boundary inclusive)", () => {
    expect(isModernRecord(R15_1_MODERN_CUTOFF)).toBe(true);
  });

  it("treats a record created 1ms BEFORE the cutoff as legacy", () => {
    const justBefore = new Date(R15_1_MODERN_CUTOFF.getTime() - 1);
    expect(isModernRecord(justBefore)).toBe(false);
  });

  it("treats a record created 1ms AFTER the cutoff as modern", () => {
    const justAfter = new Date(R15_1_MODERN_CUTOFF.getTime() + 1);
    expect(isModernRecord(justAfter)).toBe(true);
  });

  it("treats a clearly-legacy record (2026-08-01) as legacy", () => {
    expect(isModernRecord(new Date("2026-08-01T00:00:00.000Z"))).toBe(false);
  });
});