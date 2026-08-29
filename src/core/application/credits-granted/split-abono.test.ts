import { describe, expect, it } from "vitest";
import { splitAbonoCapitalInterest } from "./split-abono";

describe("splitAbonoCapitalInterest (R9/D9.3)", () => {
  it("empty abono list returns empty result", () => {
    expect(splitAbonoCapitalInterest(100_000, [])).toEqual([]);
  });

  it("abono smaller than pending principal is all capital, zero interest", () => {
    const result = splitAbonoCapitalInterest(100_000, [{ amount: 55_000 }]);
    expect(result).toEqual([{ capitalAmount: 55_000, interestAmount: 0 }]);
  });

  it("criterion 1: abono crossing the limit splits capital + interest", () => {
    const result = splitAbonoCapitalInterest(100_000, [
      { amount: 55_000 },
      { amount: 55_000 },
    ]);
    expect(result).toEqual([
      { capitalAmount: 55_000, interestAmount: 0 },
      { capitalAmount: 45_000, interestAmount: 10_000 },
    ]);
  });

  it("criterion 2: agreement with no interest recovers all principal, income 0", () => {
    const result = splitAbonoCapitalInterest(100_000, [
      { amount: 50_000 },
      { amount: 50_000 },
    ]);
    expect(result).toEqual([
      { capitalAmount: 50_000, interestAmount: 0 },
      { capitalAmount: 50_000, interestAmount: 0 },
    ]);
  });

  it("abono after principal fully recovered is all interest", () => {
    const result = splitAbonoCapitalInterest(100_000, [
      { amount: 100_000 },
      { amount: 20_000 },
    ]);
    expect(result).toEqual([
      { capitalAmount: 100_000, interestAmount: 0 },
      { capitalAmount: 0, interestAmount: 20_000 },
    ]);
  });

  it("three abonos accumulate capital recovery across installments", () => {
    const result = splitAbonoCapitalInterest(100_000, [
      { amount: 30_000 },
      { amount: 30_000 },
      { amount: 60_000 },
    ]);
    expect(result).toEqual([
      { capitalAmount: 30_000, interestAmount: 0 },
      { capitalAmount: 30_000, interestAmount: 0 },
      { capitalAmount: 40_000, interestAmount: 20_000 },
    ]);
  });
});
