import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  addAdjustedStock,
  receiveValuedStock,
  removeValuedStock,
  restoreUnvaluedStock,
} from "./inventory-valuation";

describe("inventory valuation", () => {
  it("sets the value when receiving into empty stock", () => {
    expect(receiveValuedStock({ quantity: 0, valueMinor: 0 }, 10, 5000)).toEqual({
      quantity: 10,
      valueMinor: 5000,
    });
  });

  it("adds receipt values and quantities without converting currency", () => {
    expect(receiveValuedStock({ quantity: 10, valueMinor: 5000 }, 10, 6000)).toEqual({
      quantity: 20,
      valueMinor: 11000,
    });
  });

  it("keeps the total cost unknown when legacy stock has no opening value", () => {
    expect(receiveValuedStock({ quantity: 10, valueMinor: null }, 5, 3000)).toEqual({
      quantity: 15,
      valueMinor: null,
    });
  });

  it("removes average cost and gives the exact remainder on full depletion", () => {
    const half = removeValuedStock({ quantity: 3, valueMinor: 100 }, 1);
    expect(half).toEqual({
      remaining: { quantity: 2, valueMinor: 67 },
      removedValueMinor: 33,
    });
    expect(removeValuedStock(half.remaining, 2)).toEqual({
      remaining: { quantity: 0, valueMinor: 0 },
      removedValueMinor: 67,
    });
  });

  it("preserves unknown cost when removing legacy stock", () => {
    expect(removeValuedStock({ quantity: 8, valueMinor: null }, 3)).toEqual({
      remaining: { quantity: 5, valueMinor: null },
      removedValueMinor: null,
    });
  });

  it("restores an unknown-cost sale without claiming the returned stock was free", () => {
    expect(restoreUnvaluedStock({ quantity: 3, valueMinor: 1500 }, 2)).toEqual({
      quantity: 5,
      valueMinor: null,
    });
  });

  it("rejects invalid quantities and costs", () => {
    expect(() => receiveValuedStock({ quantity: 4, valueMinor: 100 }, 0, 0)).toThrow(
      ValidationError,
    );
    expect(() => receiveValuedStock({ quantity: 4, valueMinor: -1 }, 1, 10)).toThrow(
      ValidationError,
    );
    expect(() => removeValuedStock({ quantity: 2, valueMinor: 100 }, 3)).toThrow(ValidationError);
    expect(() => addAdjustedStock({ quantity: 0, valueMinor: 0 }, 1, -1)).toThrow(ValidationError);
  });
});
