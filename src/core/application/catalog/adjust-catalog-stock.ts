import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit, quantityToBaseUnits } from "../../domain/inventory-units";
import { addAdjustedStock, removeValuedStock } from "../../domain/inventory-valuation";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";

export async function adjustCatalogStock(
  workspaceId: string,
  itemId: string,
  input: {
    direction: "in" | "out";
    quantity: number;
    reason: string;
    actorUserId: string;
    adjustmentValueMinor?: number;
  },
  catalogRepo: CatalogItemRepository,
  uow: UnitOfWork,
): Promise<void> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 160)
    throw new ValidationError("A reason of up to 160 characters is required");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0)
    throw new ValidationError("Adjustment quantity must be positive");
  if (
    input.direction === "in" &&
    (input.adjustmentValueMinor === undefined ||
      !Number.isSafeInteger(input.adjustmentValueMinor) ||
      input.adjustmentValueMinor < 0)
  ) {
    throw new ValidationError("A valid total value is required for stock added manually");
  }
  if (!catalogRepo.adjustStock) throw new ValidationError("Stock adjustment is not supported");

  await uow.withTransaction(async (tx) => {
    const item = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!item) throw new NotFoundError("Catalog item not found");
    if (item.type !== "product")
      throw new ValidationError("Only products can have stock adjustments");
    if (item.comboVersions.length > 0)
      throw new ValidationError("Combo availability is derived from its components");

    const amount = quantityToBaseUnits(input.quantity, item.saleUnit);
    const delta = input.direction === "in" ? amount : -amount;
    const current = { quantity: item.stock!, valueMinor: item.inventoryValueMinor ?? null };
    if (delta < 0 && Math.abs(delta) > current.quantity) {
      throw new ConflictError("Insufficient stock or catalog item changed");
    }
    const next =
      delta > 0
        ? addAdjustedStock(current, delta, input.adjustmentValueMinor!)
        : removeValuedStock(current, Math.abs(delta)).remaining;
    const valueDeltaMinor =
      next.valueMinor === null || current.valueMinor === null
        ? null
        : next.valueMinor - current.valueMinor;

    const updated = await catalogRepo.adjustStock!(
      workspaceId,
      itemId,
      delta,
      {
        reason,
        actorUserId: input.actorUserId,
        date: new Date(),
        unit: getBaseUnit(item.saleUnit),
        expectedInventoryValueMinor: item.inventoryValueMinor ?? null,
        inventoryValueMinor: next.valueMinor,
        valueDeltaMinor,
      },
      tx,
    );
    if (!updated) throw new ConflictError("Insufficient stock or catalog item changed");
  });
}
