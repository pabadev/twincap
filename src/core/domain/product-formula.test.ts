import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { createProductFormulaVersion } from "./product-formula";

describe("createProductFormulaVersion", () => {
  it("stores component amounts as integer base atoms", () => {
    const formula = createProductFormulaVersion({
      version: 1,
      yieldQuantity: 1,
      yieldUnit: "unit",
      components: [{ itemId: "flour", name: "Flour", quantity: 0.25, unit: "kg" }],
    });
    expect(formula.yieldStockQuantity).toBe(1);
    expect(formula.components[0].stockQuantity).toBe(250_000);
  });

  it("rejects duplicate components and invalid version numbers", () => {
    expect(() =>
      createProductFormulaVersion({
        version: 0,
        yieldQuantity: 1,
        yieldUnit: "unit",
        components: [{ itemId: "x", name: "X", quantity: 1, unit: "unit" }],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createProductFormulaVersion({
        version: 1,
        yieldQuantity: 1,
        yieldUnit: "unit",
        components: [
          { itemId: "x", name: "X", quantity: 1, unit: "unit" },
          { itemId: "x", name: "X again", quantity: 1, unit: "unit" },
        ],
      }),
    ).toThrow(ValidationError);
  });
});
