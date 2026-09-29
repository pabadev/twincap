import type { SerializedCatalogItem } from "../../../../core/domain/catalog";

/**
 * Owner decision (2026-09-29): the catalog prioritizes what SELLS.
 * Groups are display buckets only — no data changes. Combos/prepared
 * products stay with their own card in the sellable section; services
 * come second; supplies (never sold, cost captured on receipt) collapse
 * into a de-emphasized <details> section at the bottom.
 */
export type CatalogDisplayGroup = "sellable" | "service" | "supply";

export function catalogDisplayGroup(item: SerializedCatalogItem): CatalogDisplayGroup {
  if (item.type === "service") return "service";
  return item.productRole === "supply" ? "supply" : "sellable";
}

export function groupCatalogItems(
  items: SerializedCatalogItem[],
): Record<CatalogDisplayGroup, SerializedCatalogItem[]> {
  const groups: Record<CatalogDisplayGroup, SerializedCatalogItem[]> = {
    sellable: [],
    service: [],
    supply: [],
  };
  for (const item of items) groups[catalogDisplayGroup(item)].push(item);
  return groups;
}
