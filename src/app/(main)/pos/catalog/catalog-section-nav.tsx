"use client";

import Link from "next/link";
import { useT } from "../../../../i18n/client";

export function CatalogSectionNav({ active }: { active: "catalog" | "receipts" }) {
  const t = useT("Catalog");
  const links = [
    { id: "catalog" as const, href: "/pos/catalog", label: t("catalogSection") },
    { id: "receipts" as const, href: "/pos/catalog/receipts", label: t("receiptSection") },
  ];

  return (
    <nav aria-label={t("catalogNavigation")} className="mb-6 border-b border-surface-border">
      <div className="flex gap-2">
        {links.map((link) => {
          const selected = active === link.id;
          return (
            <Link
              key={link.id}
              href={link.href}
              aria-current={selected ? "page" : undefined}
              className={`min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
