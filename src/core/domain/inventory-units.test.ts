import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  calculateQuantitySubtotal,
  getBaseUnit,
  quantityFromBaseUnits,
  quantityToBaseUnits,
} from "./inventory-units";

describe("inventory unit conversions", () => {
  it("converts mass, volume, length and count to integer base units", () => {
    expect(quantityToBaseUnits(1.25, "kg")).toBe(1_250_000);
    expect(quantityToBaseUnits(0.75, "l")).toBe(750);
    expect(quantityToBaseUnits(2.4, "cm")).toBe(24);
    expect(quantityToBaseUnits(3, "unit")).toBe(3);
    expect(getBaseUnit("kg")).toBe("mg");
  });

  it("rejects fractional counts and quantities smaller than the base atom", () => {
    expect(() => quantityToBaseUnits(1.5, "unit")).toThrow(ValidationError);
    expect(() => quantityToBaseUnits(0.1, "mg")).toThrow(ValidationError);
    expect(() => quantityToBaseUnits(1.2345, "kg")).toThrow(ValidationError);
  });

  it("preserves display quantities and rounds money half-up", () => {
    const baseQuantity = quantityToBaseUnits(0.125, "kg");
    expect(quantityFromBaseUnits(baseQuantity, "kg")).toBe(0.125);
    expect(calculateQuantitySubtotal(baseQuantity, "kg", 100_000)).toBe(12_500);
    expect(calculateQuantitySubtotal(quantityToBaseUnits(0.001, "kg"), "kg", 500)).toBe(1);
  });
});
