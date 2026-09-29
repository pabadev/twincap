import { ConflictError, NotFoundError } from "../../domain/errors";
import type { CatalogItemRepository, SaleRepository } from "../../domain/repositories";
import type { UnitOfWork } from "../ports";
import type { TransactionHandle } from "../../domain/transaction";

/**
 * Delete a catalog item — POS-1.
 *
 * Guard: rejects deletion if any sale references this item.
 */
export async function deleteCatalogItem(
  workspaceId: string,
  itemId: string,
  catalogRepo: CatalogItemRepository,
  saleRepo: SaleRepository,
  uow?: UnitOfWork,
): Promise<void> {
  const remove = async (tx?: TransactionHandle) => {
    const existing = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!existing) throw new NotFoundError("Catalog item not found");

    if (
      catalogRepo.isFormulaComponent &&
      (await catalogRepo.isFormulaComponent(workspaceId, itemId, tx))
    ) {
      throw new ConflictError("Cannot delete a product used in a prepared product formula");
    }
    if (
      catalogRepo.isComboComponent &&
      (await catalogRepo.isComboComponent(workspaceId, itemId, tx))
    ) {
      throw new ConflictError("Cannot delete a product used in a combo");
    }

    const sales = await saleRepo.findByWorkspaceId(workspaceId, tx);
    const referenced = sales.some((sale) => sale.items.some((item) => item.itemId === itemId));
    if (referenced) {
      throw new ConflictError("Cannot delete catalog item referenced by a sale");
    }

    if (
      catalogRepo.hasInventoryHistory &&
      (await catalogRepo.hasInventoryHistory(workspaceId, itemId, tx))
    ) {
      throw new ConflictError("Cannot delete catalog item with inventory history");
    }

    await catalogRepo.delete(workspaceId, itemId, tx);
  };

  if (uow) {
    await uow.withTransaction((tx) => remove(tx));
    return;
  }
  await remove();
}
