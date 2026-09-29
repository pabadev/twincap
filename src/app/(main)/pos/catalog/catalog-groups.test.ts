import { describe, expect, it } from "vitest";
import { groupCatalogItems, catalogDisplayGroup } from "./catalog-groups";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";

function item(overrides: Partial<SerializedCatalogItem>): SerializedCatalogItem {
  return {
    id: "x",
    workspaceId: "ws",
    name: "Item",
    unitPrice: { amount: 1000, currency: "COP" },
    type: "product",
    productRole: "sellable",
    saleUnit: "unit",
    formulaVersions: [],
    comboVersions: [],
    stock: 0,
    createdAt: new Date(0),
    ...overrides,
  } as SerializedCatalogItem;
}

describe("catalog display groups", () => {
  it("prioritizes sellable products over supplies and separates services", () => {
    const groups = groupCatalogItems([
      item({ id: "supply-1", productRole: "supply" }),
      item({ id: "sell-1" }),
      item({ id: "svc-1", type: "service", stock: undefined }),
      item({ id: "sell-2-prepared", formulaVersions: [] }),
    ]);

    // Order of groups is fixed: sellable, service, supply — the owner rule
    // (what SELLS goes first, raw materials last).
    expect(groups.sellable.map((i) => i.id)).toEqual(["sell-1", "sell-2-prepared"]);
    expect(groups.service.map((i) => i.id)).toEqual(["svc-1"]);
    expect(groups.supply.map((i) => i.id)).toEqual(["supply-1"]);
  });

  it("classifies combos, prepared products and dual-role items as sellable", () => {
    expect(catalogDisplayGroup(item({ id: "c", comboVersions: [1] as never }))).toBe("sellable");
    expect(catalogDisplayGroup(item({ id: "p", formulaVersions: [1] as never }))).toBe("sellable");
    expect(catalogDisplayGroup(item({ id: "d", productRole: "both" }))).toBe("sellable");
  });
});
