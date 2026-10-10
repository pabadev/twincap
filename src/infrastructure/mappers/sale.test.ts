import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Sale } from "../../core/domain/sale";
import { Money } from "../../core/domain/money";
import type { SaleDocument } from "../models/sale";
import { toSaleDocData, toSaleEntity } from "./sale";

const ids = {
  workspace: "111111111111111111111111",
  sale: "222222222222222222222222",
  account: "333333333333333333333333",
  product: "444444444444444444444444",
};
function makeSale() {
  return new Sale({
    id: ids.sale,
    workspaceId: ids.workspace,
    items: [
      {
        itemId: ids.product,
        quantity: 2,
        unit: "unit",
        stockQuantity: 2,
        unitPrice: new Money(5000, "COP"),
        costSnapshot: {
          totalCostMinor: 1200,
          components: [{ itemId: ids.product, name: "Product", stockQuantity: 2, costMinor: 1200 }],
        },
      },
    ],
    date: new Date("2026-10-01T12:00:00Z"),
    paymentMode: "paid-in-full",
    accountId: ids.account,
    createdAt: new Date("2026-10-01T12:00:00Z"),
  });
}
describe("sale cost snapshot mapper", () => {
  it("persists and reloads immutable cost data as minor units", () => {
    const data = toSaleDocData(makeSale());
    const rawItem = (
      data.items as Array<{
        costSnapshot: {
          totalCostMinor: number;
          components: Array<{ itemId: Types.ObjectId; costMinor: number }>;
        };
      }>
    )[0]!;
    expect(rawItem.costSnapshot.totalCostMinor).toBe(1200);
    expect(rawItem.costSnapshot.components[0]?.itemId).toBeInstanceOf(Types.ObjectId);
    const entity = toSaleEntity(
      {
        ...data,
        _id: new Types.ObjectId(ids.sale),
        workspaceId: new Types.ObjectId(ids.workspace),
        items: data.items as SaleDocument["items"],
        accountId: new Types.ObjectId(ids.account),
        date: new Date("2026-10-01T12:00:00Z"),
        paymentMode: "paid-in-full",
        total: 10000,
        abonos: [],
        stockRestored: false,
        createdAt: new Date("2026-10-01T12:00:00Z"),
        updatedAt: new Date("2026-10-01T12:00:00Z"),
        __v: 0,
      } as unknown as SaleDocument,
      "COP",
    );
    expect(entity.items[0]?.costSnapshot).toEqual(makeSale().items[0]?.costSnapshot);
  });
});
