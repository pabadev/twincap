import { CatalogItem } from "../../domain/catalog";
import { Money } from "../../domain/money";
import { NotFoundError, ValidationError } from "../../domain/errors";
import type { CatalogItemRepository } from "../../domain/repositories";
import type { EditCatalogItemInput } from "./dto/catalog";
import type { UnitOfWork } from "../ports";
import type { TransactionHandle } from "../../domain/transaction";

/**
 * Update a catalog item — POS-1.
 *
 * Allowed edits: name and unitPrice. A product may change sale unit only
 * within its existing physical dimension; inventory quantity stays in base atoms.
 * Type and currency are immutable — cannot change product ↔ service
 * or rewrite the unit price currency after creation.
 */
export async function updateCatalogItem(
  workspaceId: string,
  itemId: string,
  input: EditCatalogItemInput,
  catalogRepo: CatalogItemRepository,
  uow?: UnitOfWork,
): Promise<CatalogItem> {
  const update = async (tx?: TransactionHandle) => {
    const existing = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!existing) throw new NotFoundError("Catalog item not found");

    // ACC-1/POS-1: the unit price currency is immutable.
    if (input.currency != null && input.currency !== existing.unitPrice.currency) {
      throw new ValidationError(
        `Catalog item currency is ${existing.unitPrice.currency}, declared ${input.currency}`,
      );
    }
    const saleUnit = input.saleUnit ?? existing.saleUnit;
    const productRole =
      existing.type === "product" ? (input.productRole ?? existing.productRole) : "sellable";
    if (
      existing.type === "product" &&
      existing.productRole !== "sellable" &&
      productRole === "sellable" &&
      catalogRepo.isFormulaComponent &&
      (await catalogRepo.isFormulaComponent(workspaceId, itemId, tx))
    ) {
      throw new ValidationError("Cannot change a supply used in a prepared product formula");
    }
    if (
      existing.type === "product" &&
      productRole === "supply" &&
      catalogRepo.isComboComponent &&
      (await catalogRepo.isComboComponent(workspaceId, itemId, tx))
    ) {
      throw new ValidationError("A product used in a combo cannot become supply-only");
    }
    if (existing.type === "product" && saleUnit !== existing.saleUnit) {
      throw new ValidationError("A product's sale unit cannot be changed after creation");
    }

    const updated = new CatalogItem({
      id: existing.id,
      workspaceId: existing.workspaceId,
      name: input.name ?? existing.name,
      unitPrice:
        input.unitPrice != null
          ? productRole === "supply"
            ? Money.nonNegative(input.unitPrice, input.currency ?? existing.unitPrice.currency)
            : new Money(input.unitPrice, input.currency ?? existing.unitPrice.currency)
          : existing.unitPrice,
      type: existing.type, // immutable
      productRole,
      formulaVersions: existing.formulaVersions.map((formula) => ({
        ...formula,
        components: formula.components.map((component) => ({ ...component })),
      })),
      comboVersions: existing.comboVersions.map((combo) => ({
        ...combo,
        components: combo.components.map((component) => ({ ...component })),
      })),
      stock: existing.stock,
      inventoryValueMinor: existing.inventoryValueMinor,
      saleUnit,
      createdAt: existing.createdAt,
    });

    return catalogRepo.update(updated, tx);
  };
  return uow ? uow.withTransaction(update) : update();
}
