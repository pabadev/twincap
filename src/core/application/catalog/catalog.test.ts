import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCatalogItem } from "./create-catalog-item";
import { updateCatalogItem } from "./update-catalog-item";
import { deleteCatalogItem } from "./delete-catalog-item";
import { listCatalogItems } from "./list-catalog-items";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import { NotFoundError, ConflictError, ValidationError } from "../../domain/errors";
import type { CatalogItemRepository, SaleRepository } from "../../domain/repositories";
import type { Sale } from "../../domain/sale";
import type { IdGenerator } from "../ports";

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

function fakeCatalogRepo(
  overrides: Partial<CatalogItemRepository> = {},
): CatalogItemRepository & { created: CatalogItem[]; updated: CatalogItem[]; deleted: string[] } {
  const created: CatalogItem[] = [];
  const updated: CatalogItem[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (item: CatalogItem) => {
      created.push(item);
      return item;
    }),
    update: vi.fn().mockImplementation(async (item: CatalogItem) => {
      updated.push(item);
      return item;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    decrementStock: vi.fn().mockResolvedValue(true),
    incrementStock: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeSaleRepo(
  sales: Sale[] = [],
): SaleRepository & { created: Sale[]; updated: Sale[]; deleted: string[] } {
  const created: Sale[] = [];
  const updated: Sale[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue(sales),
    findByClientIdPage: vi.fn().mockResolvedValue({ sales: [], total: 0 }),
    create: vi.fn().mockImplementation(async (sale: Sale) => {
      created.push(sale);
      return sale;
    }),
    update: vi.fn().mockImplementation(async (sale: Sale) => {
      updated.push(sale);
      return sale;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    addAbono: vi.fn().mockResolvedValue(undefined),
    editAbono: vi.fn().mockResolvedValue(undefined),
    deleteAbono: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

function makeProduct(
  overrides: Partial<ConstructorParameters<typeof CatalogItem>[0]> = {},
): CatalogItem {
  return new CatalogItem({
    id: "cat-1",
    workspaceId: "user-1",
    name: "Widget",
    unitPrice: new Money(5000, "COP"),
    type: "product",
    stock: 10,
    createdAt: new Date(),
    ...overrides,
  });
}

function makeService(
  overrides: Partial<ConstructorParameters<typeof CatalogItem>[0]> = {},
): CatalogItem {
  // Services must not have stock — explicitly exclude it
  return new CatalogItem({
    id: overrides.id ?? "cat-2",
    workspaceId: overrides.workspaceId ?? "user-1",
    name: overrides.name ?? "Consulting",
    unitPrice: overrides.unitPrice ?? new Money(50000, "COP"),
    type: "service",
    createdAt: overrides.createdAt ?? new Date(),
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe("createCatalogItem", () => {
  it("creates a product with stock", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    const item = await createCatalogItem(
      "user-1",
      { name: "Widget", unitPrice: 5000, currency: "COP", type: "product", stock: 10 },
      catalogRepo,
      ids,
    );

    expect(item.name).toBe("Widget");
    expect(item.type).toBe("product");
    expect(item.stock).toBe(10);
    expect(item.unitPrice.amount).toBe(5000);
    expect(catalogRepo.created).toHaveLength(1);
  });

  it("creates a service without stock", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    const item = await createCatalogItem(
      "user-1",
      { name: "Consulting", unitPrice: 50000, currency: "COP", type: "service" },
      catalogRepo,
      ids,
    );

    expect(item.type).toBe("service");
    expect(item.stock).toBeUndefined();
  });

  it("allows a supply-only catalog item without a sale price", async () => {
    const catalogRepo = fakeCatalogRepo();
    const item = await createCatalogItem(
      "user-1",
      {
        name: "Alcohol",
        unitPrice: 0,
        currency: "COP",
        type: "product",
        productRole: "supply",
        saleUnit: "ml",
        stock: 0,
      },
      catalogRepo,
      fakeIdGen(),
    );

    expect(item.productRole).toBe("supply");
    expect(item.unitPrice.amount).toBe(0);
  });

  it("throws ValidationError for product without stock", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    await expect(
      createCatalogItem(
        "user-1",
        { name: "Widget", unitPrice: 5000, currency: "COP", type: "product" },
        catalogRepo,
        ids,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for service with stock", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    await expect(
      createCatalogItem(
        "user-1",
        { name: "Consulting", unitPrice: 50000, currency: "COP", type: "service", stock: 5 },
        catalogRepo,
        ids,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for negative stock", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    await expect(
      createCatalogItem(
        "user-1",
        { name: "Widget", unitPrice: 5000, currency: "COP", type: "product", stock: -1 },
        catalogRepo,
        ids,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("allows product with stock = 0", async () => {
    const catalogRepo = fakeCatalogRepo();
    const ids = fakeIdGen();

    const item = await createCatalogItem(
      "user-1",
      { name: "Widget", unitPrice: 5000, currency: "COP", type: "product", stock: 0 },
      catalogRepo,
      ids,
    );

    expect(item.stock).toBe(0);
  });

  it("stores granular opening stock as integer base atoms", async () => {
    const catalogRepo = fakeCatalogRepo();
    const item = await createCatalogItem(
      "user-1",
      {
        name: "Café",
        unitPrice: 100_000,
        currency: "COP",
        type: "product",
        saleUnit: "kg",
        stock: 1.25,
      },
      catalogRepo,
      fakeIdGen(),
    );

    expect(item.saleUnit).toBe("kg");
    expect(item.stock).toBe(1_250_000);
  });
});

// ─── Update ────────────────────────────────────────────────────────

describe("updateCatalogItem", () => {
  it("updates name and unitPrice", async () => {
    const existing = makeProduct();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateCatalogItem(
      "user-1",
      "cat-1",
      { name: "New Widget", unitPrice: 7500 },
      catalogRepo,
    );

    expect(updated.name).toBe("New Widget");
    expect(updated.unitPrice.amount).toBe(7500);
    expect(updated.type).toBe("product");
    expect(updated.stock).toBe(10);
    expect(catalogRepo.update).toHaveBeenCalledOnce();
  });

  it("does not allow changing a product sale unit after creation", async () => {
    const existing = makeProduct({ stock: 10, saleUnit: "kg" });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    await expect(
      updateCatalogItem("user-1", "cat-1", { saleUnit: "g" }, catalogRepo),
    ).rejects.toThrow(ValidationError);
    expect(catalogRepo.update).not.toHaveBeenCalled();
  });

  it("preserves stock when not provided in update", async () => {
    const existing = makeProduct({ stock: 10 });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateCatalogItem(
      "user-1",
      "cat-1",
      { name: "Renamed Widget" },
      catalogRepo,
    );

    expect(updated.stock).toBe(10);
  });

  it("preserves undefined stock for services", async () => {
    const existing = makeService();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateCatalogItem(
      "user-1",
      "cat-2",
      { name: "New Service" },
      catalogRepo,
    );

    expect(updated.type).toBe("service");
    expect(updated.stock).toBeUndefined();
  });

  it("does not convert a formula component into a non-supply product", async () => {
    const existing = makeProduct({ productRole: "both" });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
      isFormulaComponent: vi.fn().mockResolvedValue(true),
    });

    await expect(
      updateCatalogItem("user-1", existing.id, { productRole: "sellable" }, catalogRepo),
    ).rejects.toThrow("used in a prepared product formula");
    expect(catalogRepo.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when item does not exist", async () => {
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(null),
    });

    await expect(
      updateCatalogItem("user-1", "missing", { name: "X" }, catalogRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it("type remains immutable on update", async () => {
    const existing = makeProduct({ stock: 5 });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    // Even if we tried to pass type: 'service', the use case ignores it
    const updated = await updateCatalogItem(
      "user-1",
      "cat-1",
      { name: "Still Product" },
      catalogRepo,
    );

    expect(updated.type).toBe("product");
  });

  it("currency remains immutable on update (POS-1)", async () => {
    const existing = makeProduct({ unitPrice: new Money(5000, "COP") });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    await expect(
      updateCatalogItem("user-1", "cat-1", { unitPrice: 7500, currency: "USD" }, catalogRepo),
    ).rejects.toThrow(ValidationError);
    expect(catalogRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Delete ────────────────────────────────────────────────────────

describe("deleteCatalogItem", () => {
  it("preserves inventory receipts and stock ledger history by preventing deletion", async () => {
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(makeProduct({ id: "cat-1" })),
      hasInventoryHistory: vi.fn().mockResolvedValue(true),
    });
    const saleRepo = fakeSaleRepo();

    await expect(deleteCatalogItem("user-1", "cat-1", catalogRepo, saleRepo)).rejects.toThrow(
      "Cannot delete catalog item with inventory history",
    );
    expect(catalogRepo.deleted).toHaveLength(0);
    expect(saleRepo.findByWorkspaceId).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced catalog item", async () => {
    const existing = makeProduct();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const saleRepo = fakeSaleRepo([]);

    await deleteCatalogItem("user-1", "cat-1", catalogRepo, saleRepo);

    expect(catalogRepo.deleted).toContain("cat-1");
  });

  it("throws ConflictError when referenced by a sale", async () => {
    const existing = makeProduct();
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    // Fake sale that references the catalog item
    const sale = {
      id: "sale-1",
      workspaceId: "user-1",
      items: [{ itemId: "cat-1", quantity: 2, unitPrice: new Money(5000, "COP"), subtotal: 10000 }],
      date: new Date(),
      paymentMode: "paid-in-full" as const,
      accountId: "acc-1",
      total: 10000,
      stockRestored: false,
      createdAt: new Date(),
    } as unknown as Sale;
    const saleRepo = fakeSaleRepo([sale]);

    await expect(deleteCatalogItem("user-1", "cat-1", catalogRepo, saleRepo)).rejects.toThrow(
      ConflictError,
    );
  });

  it("throws NotFoundError when item does not exist", async () => {
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const saleRepo = fakeSaleRepo([]);

    await expect(deleteCatalogItem("user-1", "missing", catalogRepo, saleRepo)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deletes when sales exist but none reference this item", async () => {
    const existing = makeProduct({ id: "cat-1" });
    const catalogRepo = fakeCatalogRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    // Sale references a different item
    const sale = {
      id: "sale-1",
      workspaceId: "user-1",
      items: [
        { itemId: "other-item", quantity: 1, unitPrice: new Money(5000, "COP"), subtotal: 5000 },
      ],
      date: new Date(),
      paymentMode: "paid-in-full" as const,
      accountId: "acc-1",
      total: 5000,
      stockRestored: false,
      createdAt: new Date(),
    } as unknown as Sale;
    const saleRepo = fakeSaleRepo([sale]);

    await deleteCatalogItem("user-1", "cat-1", catalogRepo, saleRepo);

    expect(catalogRepo.deleted).toContain("cat-1");
  });
});

// ─── List ──────────────────────────────────────────────────────────

describe("listCatalogItems", () => {
  it("returns all items for user", async () => {
    const product = makeProduct();
    const service = makeService();
    const catalogRepo = fakeCatalogRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([product, service]),
    });

    const items = await listCatalogItems("user-1", catalogRepo);

    expect(items).toHaveLength(2);
    expect(items[0].type).toBe("product");
    expect(items[1].type).toBe("service");
  });

  it("returns empty array when no items", async () => {
    const catalogRepo = fakeCatalogRepo({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
    });

    const items = await listCatalogItems("user-1", catalogRepo);

    expect(items).toHaveLength(0);
  });
});
