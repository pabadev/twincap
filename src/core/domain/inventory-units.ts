import { ValidationError } from "./errors";
import { assertSafeMinorUnits } from "./money";

export const INVENTORY_UNITS = ["unit", "mg", "g", "kg", "ml", "l", "mm", "cm", "m"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

const UNIT_TO_BASE: Record<InventoryUnit, { base: InventoryUnit; factor: number }> = {
  unit: { base: "unit", factor: 1 },
  mg: { base: "mg", factor: 1 },
  g: { base: "mg", factor: 1_000 },
  kg: { base: "mg", factor: 1_000_000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1_000 },
  mm: { base: "mm", factor: 1 },
  cm: { base: "mm", factor: 10 },
  m: { base: "mm", factor: 1_000 },
};

export function isInventoryUnit(value: string): value is InventoryUnit {
  return (INVENTORY_UNITS as readonly string[]).includes(value);
}

export function getBaseUnit(unit: InventoryUnit): InventoryUnit {
  if (!isInventoryUnit(unit)) throw new ValidationError("Unknown inventory unit");
  return UNIT_TO_BASE[unit].base;
}

export function getUnitFactorToBase(unit: InventoryUnit): number {
  if (!isInventoryUnit(unit)) throw new ValidationError("Unknown inventory unit");
  return UNIT_TO_BASE[unit].factor;
}

/** Convert an entered quantity to an integer count of the unit's base atoms. */
export function quantityToBaseUnits(
  quantity: number,
  unit: InventoryUnit,
  allowZero = false,
): number {
  if (!isInventoryUnit(unit)) throw new ValidationError("Unknown inventory unit");
  if (!Number.isFinite(quantity) || quantity < 0 || (!allowZero && quantity === 0)) {
    throw new ValidationError("Inventory quantity must be positive");
  }
  if (unit === "unit" && !Number.isInteger(quantity)) {
    throw new ValidationError("Unit quantities must be whole numbers");
  }

  const thousandths = Math.round(quantity * 1_000);
  if (!Number.isSafeInteger(thousandths) || Math.abs(quantity - thousandths / 1_000) > 1e-9) {
    throw new ValidationError("Inventory quantities support at most three decimal places");
  }

  const product = BigInt(thousandths) * BigInt(getUnitFactorToBase(unit));
  if (product % BigInt(1_000) !== BigInt(0)) {
    throw new ValidationError(`Quantity is too precise for ${unit}`);
  }
  const baseQuantity = Number(product / BigInt(1_000));
  if (!Number.isSafeInteger(baseQuantity)) {
    throw new ValidationError("Inventory quantity exceeds the supported range");
  }
  return baseQuantity;
}

export function quantityFromBaseUnits(baseQuantity: number, unit: InventoryUnit): number {
  if (!isInventoryUnit(unit)) throw new ValidationError("Unknown inventory unit");
  if (!Number.isSafeInteger(baseQuantity) || baseQuantity < 0) {
    throw new ValidationError("Stored inventory quantity is invalid");
  }
  return baseQuantity / getUnitFactorToBase(unit);
}

/** Price per sale unit × quantity, rounded half-up to the currency's minor unit. */
export function calculateQuantitySubtotal(
  baseQuantity: number,
  unit: InventoryUnit,
  pricePerUnit: number,
): number {
  if (!Number.isSafeInteger(baseQuantity) || baseQuantity <= 0) {
    throw new ValidationError("Inventory quantity must be positive");
  }
  assertSafeMinorUnits(pricePerUnit, "Sale unit price");
  if (pricePerUnit <= 0) {
    throw new ValidationError("Sale unit price must be positive");
  }

  const numerator = BigInt(baseQuantity) * BigInt(pricePerUnit);
  const denominator = BigInt(getUnitFactorToBase(unit));
  const rounded = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
  const subtotal = Number(rounded);
  assertSafeMinorUnits(subtotal, "Sale line item subtotal");
  if (subtotal <= 0) {
    throw new ValidationError("Line item total is below the currency's minimum amount");
  }
  return subtotal;
}
