import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit, quantityToBaseUnits } from "../../domain/inventory-units";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";

export async function adjustCatalogStock(
  workspaceId: string,
  itemId: string,
  input: { direction: "in" | "out"; quantity: number; reason: string; actorUserId: string },
  catalogRepo: CatalogItemRepository,
  uow: UnitOfWork,
): Promise<void> {
  const item = await catalogRepo.findById(workspaceId, itemId);
  if (!item) throw new NotFoundError("Catalog item not found");
  if (item.type !== "product")
    throw new ValidationError("Only products can have stock adjustments");
  if (item.comboVersions.length > 0)
    throw new ValidationError("Combo availability is derived from its components");
  const reason = input.reason.trim();
  if (!reason || reason.length > 160)
    throw new ValidationError("A reason of up to 160 characters is required");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0)
    throw new ValidationError("Adjustment quantity must be positive");
  if (!catalogRepo.adjustStock) throw new ValidationError("Stock adjustment is not supported");

  const amount = quantityToBaseUnits(input.quantity, item.saleUnit);
  const delta = input.direction === "in" ? amount : -amount;
  await uow.withTransaction(async (tx) => {
    const updated = await catalogRepo.adjustStock!(
      workspaceId,
      itemId,
      delta,
      {
        reason,
        actorUserId: input.actorUserId,
        date: new Date(),
        unit: getBaseUnit(item.saleUnit),
      },
      tx,
    );
    if (!updated) throw new ConflictError("Insufficient stock or catalog item changed");
  });
}
