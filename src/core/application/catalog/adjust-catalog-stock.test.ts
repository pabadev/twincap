import { describe, expect, it, vi } from "vitest";
import { adjustCatalogStock } from "./adjust-catalog-stock";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import type { TransactionHandle } from "../../domain/transaction";

function makeItem(type: "product" | "service" = "product") {
  return new CatalogItem({
    id: "item-1",
    workspaceId: "workspace-1",
    name: "Coffee",
    type,
    stock: type === "product" ? 2_000_000 : undefined,
    saleUnit: "kg",
    unitPrice: new Money(500, "COP"),
    createdAt: new Date(),
  });
}

function dependencies(item = makeItem()) {
  const tx = {} as TransactionHandle;
  const catalogRepo = {
    findById: vi.fn().mockResolvedValue(item),
    adjustStock: vi.fn().mockResolvedValue(true),
  } as unknown as CatalogItemRepository;
  const uow: UnitOfWork = {
    withTransaction<T>(fn: (handle: TransactionHandle) => Promise<T>) {
      return fn(tx);
    },
  };
  return { catalogRepo, uow };
}

describe("adjustCatalogStock", () => {
  it("converts the entered unit to base atoms and records the reason", async () => {
    const { catalogRepo, uow } = dependencies();
    await adjustCatalogStock(
      "workspace-1",
      "item-1",
      { direction: "in", quantity: 0.5, reason: "Conteo físico", actorUserId: "user-1" },
      catalogRepo,
      uow,
    );
    expect(catalogRepo.adjustStock).toHaveBeenCalledWith(
      "workspace-1",
      "item-1",
      500_000,
      expect.objectContaining({ reason: "Conteo físico", unit: "mg" }),
      expect.anything(),
    );
  });

  it("does not allow stock to go below zero", async () => {
    const { catalogRepo, uow } = dependencies();
    vi.mocked(catalogRepo.adjustStock!).mockResolvedValue(false);
    await expect(
      adjustCatalogStock(
        "workspace-1",
        "item-1",
        { direction: "out", quantity: 3, reason: "Merma", actorUserId: "user-1" },
        catalogRepo,
        uow,
      ),
    ).rejects.toThrow("Insufficient stock or catalog item changed");
  });

  it("rejects services and adjustments without a reason", async () => {
    const service = dependencies(makeItem("service"));
    await expect(
      adjustCatalogStock(
        "workspace-1",
        "item-1",
        { direction: "in", quantity: 1, reason: "ok", actorUserId: "user-1" },
        service.catalogRepo,
        service.uow,
      ),
    ).rejects.toThrow("Only products can have stock adjustments");

    const product = dependencies();
    await expect(
      adjustCatalogStock(
        "workspace-1",
        "item-1",
        { direction: "in", quantity: 1, reason: " ", actorUserId: "user-1" },
        product.catalogRepo,
        product.uow,
      ),
    ).rejects.toThrow("A reason of up to 160 characters is required");
  });
});
