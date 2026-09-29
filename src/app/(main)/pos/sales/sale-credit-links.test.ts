import { describe, expect, it } from "vitest";
import { creditLaunchHref, mapSaleIdsToCreditIds } from "./sale-credit-links";

describe("sale-credit links", () => {
  it("maps each POS sale to its exact linked granted credit", () => {
    expect(
      mapSaleIdsToCreditIds([
        { id: "credit-a", saleId: "sale-a" },
        { id: "credit-b", saleId: "sale-b" },
        { id: "standalone-credit" },
      ]),
    ).toEqual({ "sale-a": "credit-a", "sale-b": "credit-b" });
  });

  it("creates a safely encoded destination for the exact credit", () => {
    expect(creditLaunchHref("credit/with space")).toBe(
      "/credits/granted?highlight=credit%2Fwith%20space",
    );
  });
});
