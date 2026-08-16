import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  CURRENCY_EXPONENTS,
  DEFAULT_CURRENCY,
  exponentOf,
  isCurrency,
} from "./currency";

describe("currency", () => {
  it("supports exactly the seeded currency list", () => {
    expect(CURRENCIES).toEqual(["COP", "USD", "MXN", "EUR"]);
  });

  it("uses exponent 0 for COP (no minor-unit decimals)", () => {
    expect(CURRENCY_EXPONENTS.COP).toBe(0);
    expect(exponentOf("COP")).toBe(0);
  });

  it("uses exponent 2 for USD, MXN and EUR", () => {
    expect(CURRENCY_EXPONENTS.USD).toBe(2);
    expect(CURRENCY_EXPONENTS.MXN).toBe(2);
    expect(CURRENCY_EXPONENTS.EUR).toBe(2);
  });

  it("defaults new accounts to COP", () => {
    expect(DEFAULT_CURRENCY).toBe("COP");
  });

  it("recognizes seeded currencies and rejects unknown ones", () => {
    expect(isCurrency("COP")).toBe(true);
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("ARS")).toBe(false);
    expect(isCurrency("")).toBe(false);
  });
});
