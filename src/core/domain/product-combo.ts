import { ValidationError } from "./errors";
import { quantityToBaseUnits, type InventoryUnit } from "./inventory-units";

export interface ProductComboComponent {
  itemId: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  stockQuantity: number;
}

export interface ProductComboVersion {
  version: number;
  components: ProductComboComponent[];
  createdAt: Date;
}

export function createProductComboVersion(input: {
  version: number;
  components: Array<{ itemId: string; name: string; quantity: number; unit: InventoryUnit }>;
  createdAt?: Date;
}): ProductComboVersion {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new ValidationError("Combo version must be a positive integer");
  }
  if (input.components.length === 0) throw new ValidationError("Combo requires components");
  const seen = new Set<string>();
  const components = input.components.map((component) => {
    if (!component.itemId || !component.name.trim() || seen.has(component.itemId)) {
      throw new ValidationError("Combo component is invalid or duplicated");
    }
    seen.add(component.itemId);
    return {
      itemId: component.itemId,
      name: component.name.trim(),
      quantity: component.quantity,
      unit: component.unit,
      stockQuantity: quantityToBaseUnits(component.quantity, component.unit),
    };
  });
  return { version: input.version, components, createdAt: input.createdAt ?? new Date() };
}

/** Maximum whole combo count supported by the current stocks of its components. */
export function getAvailableComboCount(
  combo: ProductComboVersion,
  stockByItemId: ReadonlyMap<string, number>,
): number {
  return combo.components.reduce((available, component) => {
    const stock = stockByItemId.get(component.itemId) ?? 0;
    return Math.min(available, Math.floor(stock / component.stockQuantity));
  }, Number.MAX_SAFE_INTEGER);
}
