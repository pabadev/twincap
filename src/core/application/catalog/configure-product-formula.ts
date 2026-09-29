import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors";
import { getBaseUnit, isInventoryUnit, type InventoryUnit } from "../../domain/inventory-units";
import type { CatalogItemRepository } from "../../domain/repositories";
import { createProductFormulaVersion } from "../../domain/product-formula";
import type { UnitOfWork } from "../ports";

export interface ConfigureProductFormulaInput {
  yieldQuantity: number;
  yieldUnit: InventoryUnit;
  components: Array<{ itemId: string; quantity: number; unit: InventoryUnit }>;
}

export async function configureProductFormula(
  workspaceId: string,
  itemId: string,
  input: ConfigureProductFormulaInput,
  catalogRepo: CatalogItemRepository,
  uow: UnitOfWork,
): Promise<void> {
  await uow.withTransaction(async (tx) => {
    const product = await catalogRepo.findById(workspaceId, itemId, tx);
    if (!product) throw new NotFoundError("Prepared product not found");
    if (
      product.type !== "product" ||
      product.productRole === "supply" ||
      product.comboVersions.length > 0
    ) {
      throw new ValidationError("Only sellable products can have a formula");
    }
    if (getBaseUnit(product.saleUnit) !== getBaseUnit(input.yieldUnit)) {
      throw new ValidationError("Formula yield unit must match the prepared product unit");
    }
    const components = [];
    const seen = new Set<string>();
    for (const raw of input.components) {
      if (raw.itemId === itemId || seen.has(raw.itemId)) {
        throw new ValidationError("Formula cannot contain itself or duplicate components");
      }
      if (!isInventoryUnit(raw.unit)) throw new ValidationError("Unknown formula component unit");
      const component = await catalogRepo.findById(workspaceId, raw.itemId, tx);
      if (
        !component ||
        component.type !== "product" ||
        component.productRole === "sellable" ||
        component.comboVersions.length > 0
      ) {
        throw new ValidationError("Formula components must be inventory supplies");
      }
      if (getBaseUnit(component.saleUnit) !== getBaseUnit(raw.unit)) {
        throw new ValidationError("Formula component unit must match its inventory dimension");
      }
      const touched = await catalogRepo.touchProduct?.(workspaceId, component.id, tx);
      if (!touched) throw new ConflictError("Formula component changed concurrently");
      seen.add(raw.itemId);
      components.push({
        itemId: component.id,
        name: component.name,
        quantity: raw.quantity,
        unit: raw.unit,
      });
    }
    const formula = createProductFormulaVersion({
      version: product.formulaVersions.length + 1,
      yieldQuantity: input.yieldQuantity,
      yieldUnit: input.yieldUnit,
      components,
    });
    const appended = await catalogRepo.appendFormulaVersion?.(
      workspaceId,
      itemId,
      product.formulaVersions.length,
      formula,
      tx,
    );
    if (!appended) throw new ConflictError("Formula changed concurrently; reload and try again");
  });
}
