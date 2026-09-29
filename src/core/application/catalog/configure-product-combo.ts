import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit, isInventoryUnit, type InventoryUnit } from "../../domain/inventory-units";
import type { CatalogItemRepository, SaleRepository } from "../../domain/repositories";
import { createProductComboVersion } from "../../domain/product-combo";
import type { UnitOfWork } from "../ports";

export interface ConfigureProductComboInput {
  components: Array<{ itemId: string; quantity: number; unit: InventoryUnit }>;
}

export async function configureProductCombo(
  workspaceId: string,
  itemId: string,
  input: ConfigureProductComboInput,
  catalogRepo: CatalogItemRepository,
  saleRepo: SaleRepository,
  uow: UnitOfWork,
): Promise<void> {
  await uow.withTransaction(async (tx) => {
    const combo = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!combo) throw new NotFoundError("Combo product not found");
    if (
      combo.type !== "product" ||
      combo.productRole !== "sellable" ||
      combo.saleUnit !== "unit" ||
      combo.stock !== 0 ||
      combo.formulaVersions.length > 0
    ) {
      throw new ValidationError("Only unstocked discrete sellable products can be combos");
    }
    if (combo.comboVersions.length === 0) {
      const hasSales = saleRepo.hasSaleReference
        ? await saleRepo.hasSaleReference(workspaceId, itemId, tx)
        : (await saleRepo.findByWorkspaceId(workspaceId, tx)).some((sale) =>
            sale.items.some((line) => line.itemId === itemId),
          );
      if (hasSales) {
        throw new ValidationError("A product with sales history cannot be converted into a combo");
      }
      if (
        catalogRepo.isFormulaComponent &&
        (await catalogRepo.isFormulaComponent(workspaceId, itemId, tx))
      ) {
        throw new ValidationError("A product used in a prepared formula cannot become a combo");
      }
      if (
        catalogRepo.isComboComponent &&
        (await catalogRepo.isComboComponent(workspaceId, itemId, tx))
      ) {
        throw new ValidationError("A product already used in a combo cannot become another combo");
      }
    }

    const components = [];
    const seen = new Set<string>();
    for (const raw of input.components) {
      if (raw.itemId === itemId || seen.has(raw.itemId)) {
        throw new ValidationError("Combo cannot contain itself or duplicate components");
      }
      if (!isInventoryUnit(raw.unit)) throw new ValidationError("Unknown combo component unit");
      const component = await catalogRepo.findById(workspaceId, raw.itemId, tx);
      if (
        !component ||
        component.type !== "product" ||
        component.productRole === "supply" ||
        component.comboVersions.length > 0
      ) {
        throw new ValidationError("Combo components must be stocked sellable products, not combos");
      }
      if (getBaseUnit(component.saleUnit) !== getBaseUnit(raw.unit)) {
        throw new ValidationError("Combo component unit must match its inventory dimension");
      }
      if (!(await catalogRepo.touchProduct?.(workspaceId, component.id, tx))) {
        throw new ConflictError("Combo component changed concurrently");
      }
      seen.add(raw.itemId);
      components.push({
        itemId: component.id,
        name: component.name,
        quantity: raw.quantity,
        unit: raw.unit,
      });
    }

    const version = createProductComboVersion({
      version: combo.comboVersions.length + 1,
      components,
    });
    const appended = await catalogRepo.appendComboVersion?.(
      workspaceId,
      itemId,
      combo.comboVersions.length,
      version,
      tx,
    );
    if (!appended) throw new ConflictError("Combo changed concurrently; reload and try again");
  });
}
