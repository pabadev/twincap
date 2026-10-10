import { describe, expect, it } from "vitest";
import { CatalogItem } from "./catalog";
import { ValidationError } from "./errors";
import { Money } from "./money";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("CatalogItem entity", () => {
  it("creates a product with stock (POS-1)", () => {
    const item = new CatalogItem({
      id: "ci1",
      workspaceId: "u1",
      name: "Café",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 10,
      createdAt: DATE,
    });
    expect(item.type).toBe("product");
    expect(item.stock).toBe(10);
    expect(item.name).toBe("Café");
    expect(item.inventoryValueMinor).toBeNull();
  });

  it("uses zero inventory value for empty stock and accepts an explicit opening value", () => {
    const empty = new CatalogItem({
      id: "empty",
      workspaceId: "u1",
      name: "Empty",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 0,
      createdAt: DATE,
    });
    const valued = new CatalogItem({
      id: "valued",
      workspaceId: "u1",
      name: "Valued",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 10,
      inventoryValueMinor: 42_000,
      createdAt: DATE,
    });

    expect(empty.inventoryValueMinor).toBe(0);
    expect(valued.inventoryValueMinor).toBe(42_000);
    expect(valued.toJSON().inventoryValueMinor).toBe(42_000);
  });

  it("rejects invalid inventory values and values attached to services", () => {
    const productInput = {
      id: "bad",
      workspaceId: "u1",
      name: "Bad",
      unitPrice: new Money(5_000, "COP"),
      type: "product" as const,
      stock: 10,
      createdAt: DATE,
    };
    expect(() => new CatalogItem({ ...productInput, inventoryValueMinor: -1 })).toThrow(
      ValidationError,
    );
    expect(() => new CatalogItem({ ...productInput, stock: 0, inventoryValueMinor: 1 })).toThrow(
      ValidationError,
    );
    expect(
      () =>
        new CatalogItem({
          id: "service",
          workspaceId: "u1",
          name: "Service",
          unitPrice: new Money(5_000, "COP"),
          type: "service",
          inventoryValueMinor: 0,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("creates a service without stock (POS-1)", () => {
    const item = new CatalogItem({
      id: "ci2",
      workspaceId: "u1",
      name: "Consultoría",
      unitPrice: new Money(50_000, "COP"),
      type: "service",
      createdAt: DATE,
    });
    expect(item.type).toBe("service");
    expect(item.stock).toBeUndefined();
  });

  it("trims name and rejects empty (POS-1)", () => {
    const item = new CatalogItem({
      id: "ci1",
      workspaceId: "u1",
      name: "  Café  ",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 5,
      createdAt: DATE,
    });
    expect(item.name).toBe("Café");
    expect(
      () =>
        new CatalogItem({
          id: "ci2",
          workspaceId: "u1",
          name: "   ",
          unitPrice: new Money(5_000, "COP"),
          type: "service",
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects product without stock", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects product with negative stock", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          stock: -1,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("allows product with zero stock", () => {
    const item = new CatalogItem({
      id: "ci1",
      workspaceId: "u1",
      name: "Café",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 0,
      createdAt: DATE,
    });
    expect(item.stock).toBe(0);
  });

  it("rejects fractional stock — discrete count semantics (R15.3.1 P3)", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          stock: 1.5,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          stock: 2.0001,
          createdAt: DATE,
        }),
    ).toThrow(/non-negative safe integer/);
  });

  it("rejects service with stock", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Consultoría",
          unitPrice: new Money(50_000, "COP"),
          type: "service",
          stock: 5,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects unknown type", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "X",
          unitPrice: new Money(5_000, "COP"),
          type: "digital" as never,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects zero or negative unitPrice (Money VO enforces > 0)", () => {
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(0, "COP"),
          type: "product",
          stock: 5,
          createdAt: DATE,
        }),
    ).toThrow();
  });

  it("rejects empty ids", () => {
    expect(
      () =>
        new CatalogItem({
          id: "",
          workspaceId: "u1",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          stock: 5,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CatalogItem({
          id: "ci1",
          workspaceId: "",
          name: "Café",
          unitPrice: new Money(5_000, "COP"),
          type: "product",
          stock: 5,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });
});
