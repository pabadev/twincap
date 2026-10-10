import { describe, expect, it, vi } from "vitest";
import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { TransactionHandle } from "../../domain/transaction";
import type { UnitOfWork } from "../ports";
import { setOpeningInventoryValue } from "./set-opening-inventory-value";

const item = new CatalogItem({
  id: "item",
  workspaceId: "ws",
  name: "Product",
  type: "product",
  stock: 4,
  inventoryValueMinor: null,
  saleUnit: "unit",
  unitPrice: new Money(100, "COP"),
  createdAt: new Date(0),
});
function deps() {
  const tx = {} as TransactionHandle;
  const repo = {
    findById: vi.fn().mockResolvedValue(item),
    setOpeningInventoryValue: vi.fn().mockResolvedValue(true),
  } as unknown as CatalogItemRepository;
  const uow: UnitOfWork = { withTransaction: (fn) => fn(tx) };
  return { repo, uow };
}
describe("setOpeningInventoryValue", () => {
  it("sets the current total without changing stock", async () => {
    const { repo, uow } = deps();
    await setOpeningInventoryValue("ws", "item", 900, "user", repo, uow);
    expect(repo.setOpeningInventoryValue).toHaveBeenCalledWith(
      "ws",
      "item",
      4,
      900,
      { actorUserId: "user", unit: "unit" },
      expect.anything(),
    );
  });
  it("rejects items whose cost is already known", async () => {
    const { repo, uow } = deps();
    vi.mocked(repo.findById).mockResolvedValue(
      new CatalogItem({
        id: item.id,
        workspaceId: item.workspaceId,
        name: item.name,
        type: "product",
        stock: item.stock,
        inventoryValueMinor: 900,
        saleUnit: item.saleUnit,
        unitPrice: new Money(100, "COP"),
        createdAt: item.createdAt,
      }),
    );
    await expect(setOpeningInventoryValue("ws", "item", 900, "user", repo, uow)).rejects.toThrow();
  });
});
