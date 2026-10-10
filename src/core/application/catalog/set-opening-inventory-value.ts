import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit } from "../../domain/inventory-units";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";

export async function setOpeningInventoryValue(
  workspaceId: string,
  itemId: string,
  valueMinor: number,
  actorUserId: string,
  catalogRepo: CatalogItemRepository,
  uow: UnitOfWork,
): Promise<void> {
  if (!Number.isSafeInteger(valueMinor) || valueMinor < 0)
    throw new ValidationError("Opening inventory value is invalid");
  await uow.withTransaction(async (tx) => {
    const item = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!item) throw new NotFoundError("Catalog item not found");
    if (item.type !== "product" || !item.stock || item.inventoryValueMinor !== null) {
      throw new ConflictError("Only existing products with unknown inventory value can be valued");
    }
    const saved = await catalogRepo.setOpeningInventoryValue?.(
      workspaceId,
      itemId,
      item.stock,
      valueMinor,
      { actorUserId, unit: getBaseUnit(item.saleUnit) },
      tx,
    );
    if (!saved) throw new ConflictError("Inventory changed; reload and try again");
  });
}
