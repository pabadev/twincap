import { ValidationError } from "./errors";
import { getBaseUnit, quantityToBaseUnits, type InventoryUnit } from "./inventory-units";

export interface ProductFormulaComponent {
  itemId: string;
  name: string;
  quantity: number;
  unit: InventoryUnit;
  stockQuantity: number;
}

export interface ProductFormulaVersion {
  version: number;
  yieldQuantity: number;
  yieldUnit: InventoryUnit;
  yieldStockQuantity: number;
  components: ProductFormulaComponent[];
  createdAt: Date;
}

export function createProductFormulaVersion(input: {
  version: number;
  yieldQuantity: number;
  yieldUnit: InventoryUnit;
  components: Array<{ itemId: string; name: string; quantity: number; unit: InventoryUnit }>;
  createdAt?: Date;
}): ProductFormulaVersion {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new ValidationError("Formula version must be a positive integer");
  }
  const yieldStockQuantity = quantityToBaseUnits(input.yieldQuantity, input.yieldUnit);
  if (input.components.length === 0) throw new ValidationError("Formula requires components");
  const seen = new Set<string>();
  const components = input.components.map((component) => {
    if (!component.itemId || !component.name.trim() || seen.has(component.itemId)) {
      throw new ValidationError("Formula component is invalid or duplicated");
    }
    getBaseUnit(component.unit); // Validate the configured unit before storing its snapshot.
    seen.add(component.itemId);
    return {
      itemId: component.itemId,
      name: component.name.trim(),
      quantity: component.quantity,
      unit: component.unit,
      stockQuantity: quantityToBaseUnits(component.quantity, component.unit),
    };
  });
  return {
    version: input.version,
    yieldQuantity: input.yieldQuantity,
    yieldUnit: input.yieldUnit,
    yieldStockQuantity,
    components,
    createdAt: input.createdAt ?? new Date(),
  };
}
