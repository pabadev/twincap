import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { CatalogItem } from "../../core/domain/catalog";
import { Money, MoneyError } from "../../core/domain/money";
import { toCatalogItemDocData, toCatalogItemEntity } from "./catalog";

function makeDocument(currency?: string) {
  return {
    _id: new Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
    workspaceId: new Types.ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"),
    name: "Widget",
    unitPrice: 15000,
    currency,
    type: "product",
    stock: 3,
    createdAt: new Date("2026-09-06"),
  } as unknown as Parameters<typeof toCatalogItemEntity>[0];
}

function makeItem(): CatalogItem {
  return new CatalogItem({
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    workspaceId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    name: "Widget",
    unitPrice: new Money(15000, "COP"),
    type: "product",
    stock: 3,
    createdAt: new Date("2026-09-06"),
  });
}

describe("catalog mapper (R14-A currency persistence)", () => {
  it("persists the unit price currency in the doc data", () => {
    const data = toCatalogItemDocData(makeItem());
    expect(data.currency).toBe("COP");
  });

  it("round-trips the currency through the doc data", () => {
    const data = toCatalogItemDocData(makeItem());
    const entity = toCatalogItemEntity(
      makeDocument(data.currency as string),
    );
    expect(entity.unitPrice.currency).toBe("COP");
    expect(entity.unitPrice.amount).toBe(15000);
  });

  it("reads the persisted currency on the entity (not derived from an account)", () => {
    const entity = toCatalogItemEntity(makeDocument("USD"));
    expect(entity.unitPrice.currency).toBe("USD");
  });

  it("fails loudly for legacy documents without a persisted currency (backfill pending R14-O)", () => {
    expect(() => toCatalogItemEntity(makeDocument(undefined))).toThrow(
      MoneyError,
    );
  });

  it("fails loudly for legacy documents with an unknown currency value", () => {
    expect(() => toCatalogItemEntity(makeDocument("ARS"))).toThrow(
      MoneyError,
    );
  });
});