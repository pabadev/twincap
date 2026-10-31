"use client";

import { Tabs } from "../../../../components/ui/tabs";
import { useT } from "../../../../i18n/client";

/**
 * Deprecated wrapper kept for its call sites — the visuals/semantics now
 * come from the shared Tabs kit (variant="link"). Do not add new usages:
 * use <Tabs> directly.
 */
export function CatalogSectionNav({ active }: { active: "catalog" | "receipts" }) {
  const t = useT("Catalog");
  const links = [
    { id: "catalog" as const, href: "/pos/catalog", label: t("catalogSection") },
    { id: "receipts" as const, href: "/pos/catalog/receipts", label: t("receiptSection") },
  ];

  return (
    <Tabs
      ariaLabel={t("catalogNavigation")}
      variant="link"
      value={active}
      items={links}
      className="mb-6"
    />
  );
}
