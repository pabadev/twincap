import { describe, expect, it } from "vitest";
import { CatalogItem } from "./catalog";
import { ValidationError } from "./errors";
import { Money } from "./money";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("CatalogItem entity", () => {
  it("creates a product with stock (POS-1)", () => {
    const item = new CatalogItem({
      id: "ci1",
      userId: "u1",
      name: "Café",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 10,
      createdAt: DATE,
    });
    expect(item.type).toBe("product");
    expect(item.stock).toBe(10);
    expect(item.name).toBe("Café");
  });

  it("creates a service without stock (POS-1)", () => {
    const item = new CatalogItem({
      id: "ci2",
      userId: "u1",
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
      userId: "u1",
      name: "  Café  ",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 5,
      createdAt: DATE,
    });
    expect(item.name).toBe("Café");
    expect(() =>
      new CatalogItem({
        id: "ci2",
        userId: "u1",
        name: "   ",
        unitPrice: new Money(5_000, "COP"),
        type: "service",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects product without stock", () => {
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "u1",
        name: "Café",
        unitPrice: new Money(5_000, "COP"),
        type: "product",
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects product with negative stock", () => {
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "u1",
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
      userId: "u1",
      name: "Café",
      unitPrice: new Money(5_000, "COP"),
      type: "product",
      stock: 0,
      createdAt: DATE,
    });
    expect(item.stock).toBe(0);
  });

  it("rejects service with stock", () => {
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "u1",
        name: "Consultoría",
        unitPrice: new Money(50_000, "COP"),
        type: "service",
        stock: 5,
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects unknown type", () => {
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "u1",
        name: "X",
        unitPrice: new Money(5_000, "COP"),
        type: "digital" as never,
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects zero or negative unitPrice (Money VO enforces > 0)", () => {
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "u1",
        name: "Café",
        unitPrice: new Money(0, "COP"),
        type: "product",
        stock: 5,
        createdAt: DATE,
      }),
    ).toThrow();
  });

  it("rejects empty ids", () => {
    expect(() =>
      new CatalogItem({
        id: "",
        userId: "u1",
        name: "Café",
        unitPrice: new Money(5_000, "COP"),
        type: "product",
        stock: 5,
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      new CatalogItem({
        id: "ci1",
        userId: "",
        name: "Café",
        unitPrice: new Money(5_000, "COP"),
        type: "product",
        stock: 5,
        createdAt: DATE,
      }),
    ).toThrow(ValidationError);
  });
});
