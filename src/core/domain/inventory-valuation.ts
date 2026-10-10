import { ValidationError } from "./errors";
import { assertSafeMinorUnits } from "./money";

export interface InventoryValuation {
  quantity: number;
  /** Total acquisition value in currency minor units; null means unknown. */
  valueMinor: number | null;
}

function assertQuantity(quantity: number, label: string): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new ValidationError(`${label} must be a non-negative safe integer`);
  }
}

function assertValue(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative safe integer`);
  }
}

/** Add a received quantity/value using a moving weighted-average inventory basis. */
export function receiveValuedStock(
  current: InventoryValuation,
  receivedQuantity: number,
  receivedValueMinor: number,
): InventoryValuation {
  assertQuantity(current.quantity, "Current stock quantity");
  assertQuantity(receivedQuantity, "Received stock quantity");
  assertValue(receivedValueMinor, "Received stock value");
  if (receivedQuantity === 0) throw new ValidationError("Received stock quantity must be positive");
  if (current.valueMinor !== null) assertValue(current.valueMinor, "Current stock value");

  const quantity = current.quantity + receivedQuantity;
  if (!Number.isSafeInteger(quantity)) {
    throw new ValidationError("Inventory quantity exceeds the supported range");
  }
  if (current.quantity === 0) {
    return { quantity, valueMinor: receivedValueMinor };
  }
  if (current.valueMinor === null) {
    return { quantity, valueMinor: null };
  }
  const valueMinor = current.valueMinor + receivedValueMinor;
  assertSafeMinorUnits(valueMinor, "Inventory value after receipt");
  return { quantity, valueMinor };
}

/** Allocate current average cost to removed stock; full depletion takes the exact remainder. */
export function removeValuedStock(
  current: InventoryValuation,
  removedQuantity: number,
): { remaining: InventoryValuation; removedValueMinor: number | null } {
  assertQuantity(current.quantity, "Current stock quantity");
  assertQuantity(removedQuantity, "Removed stock quantity");
  if (current.valueMinor !== null) assertValue(current.valueMinor, "Current stock value");
  if (removedQuantity === 0 || removedQuantity > current.quantity) {
    throw new ValidationError("Removed stock quantity must be positive and available");
  }

  if (current.valueMinor === null) {
    return {
      remaining: { quantity: current.quantity - removedQuantity, valueMinor: null },
      removedValueMinor: null,
    };
  }

  const removedValueMinor =
    removedQuantity === current.quantity
      ? current.valueMinor
      : Number(
          (BigInt(current.valueMinor) * BigInt(removedQuantity) * BigInt(2) +
            BigInt(current.quantity)) /
            (BigInt(current.quantity) * BigInt(2)),
        );
  assertValue(removedValueMinor, "Removed stock value");
  const remainingValue = current.valueMinor - removedValueMinor;
  return {
    remaining: {
      quantity: current.quantity - removedQuantity,
      valueMinor: remainingValue,
    },
    removedValueMinor,
  };
}

/** Add manually adjusted stock at its explicitly supplied acquisition value. */
export function addAdjustedStock(
  current: InventoryValuation,
  addedQuantity: number,
  addedValueMinor: number,
): InventoryValuation {
  return receiveValuedStock(current, addedQuantity, addedValueMinor);
}

/** Restore physical stock with unknown historical cost without implying it was free. */
export function restoreUnvaluedStock(
  current: InventoryValuation,
  restoredQuantity: number,
): InventoryValuation {
  assertQuantity(current.quantity, "Current stock quantity");
  assertQuantity(restoredQuantity, "Restored stock quantity");
  if (restoredQuantity === 0) throw new ValidationError("Restored stock quantity must be positive");
  const quantity = current.quantity + restoredQuantity;
  if (!Number.isSafeInteger(quantity))
    throw new ValidationError("Restored stock quantity exceeds the supported range");
  return { quantity, valueMinor: null };
}
