import type { CatalogItemType } from "../../../../core/domain/catalog";

export function catalogTypeBadgeClasses(type: CatalogItemType): string {
  return type === "product"
    ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
    : "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200";
}
