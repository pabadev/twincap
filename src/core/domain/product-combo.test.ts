import { describe, expect, it } from "vitest";
import { createProductComboVersion, getAvailableComboCount } from "./product-combo";
import { ValidationError } from "./errors";

describe("product combos", () => {
  const combo = createProductComboVersion({
    version: 1,
    components: [
      { itemId: "cup", name: "Cup", quantity: 1, unit: "unit" },
      { itemId: "coffee", name: "Coffee", quantity: 250, unit: "g" },
    ],
  });

  it("stores fixed composition as exact stock atoms", () => {
    expect(combo.components.map((component) => component.stockQuantity)).toEqual([1, 250_000]);
  });

  it("calculates whole combo availability from the limiting component", () => {
    expect(
      getAvailableComboCount(
        combo,
        new Map([
          ["cup", 8],
          ["coffee", 750_000],
        ]),
      ),
    ).toBe(3);
  });

  it("rejects duplicate component references", () => {
    expect(() =>
      createProductComboVersion({
        version: 1,
        components: [
          { itemId: "cup", name: "Cup", quantity: 1, unit: "unit" },
          { itemId: "cup", name: "Duplicate", quantity: 2, unit: "unit" },
        ],
      }),
    ).toThrow(ValidationError);
  });
});
