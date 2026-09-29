"use client";

import { useState, useEffect, useMemo } from "react";
import { useT, useLocale } from "../../../../i18n/client";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import { CatalogForm } from "./catalog-form";
import { DeleteCatalogItemButton } from "./delete-catalog-item-button";
import { formatAmount } from "../../../../lib/format";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Icon } from "../../../../components/ui/icon";
import { Modal } from "../../../../components/ui/modal";
import { Button } from "../../../../components/ui/button";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { ArrowDownUp, ChefHat, Package, PackagePlus, Pencil, Search } from "lucide-react";
import { quantityFromBaseUnits } from "../../../../core/domain/inventory-units";
import { getAvailableComboCount } from "../../../../core/domain/product-combo";
import { StockControls } from "./stock-controls";
import { CatalogItemCard } from "./catalog-item-card";
import { CATALOG_GRID_CLASSES } from "./catalog-grid-layout";
import { ProductFormulaForm } from "./product-formula-form";
import { ProductComboForm } from "./product-combo-form";
import { CatalogSectionNav } from "./catalog-section-nav";

export function CatalogList({
  items,
  highlightItemId,
  defaultCurrency,
}: {
  items: SerializedCatalogItem[];
  highlightItemId?: string;
  defaultCurrency?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SerializedCatalogItem | null>(null);
  const [formulaItem, setFormulaItem] = useState<SerializedCatalogItem | null>(null);
  const [comboItem, setComboItem] = useState<SerializedCatalogItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const t = useT("Catalog");
  const locale = useLocale();
  const stockByItemId = new Map(items.map((item) => [item.id, item.stock ?? 0]));

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter items by name (case-insensitive)
  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return items;
    const query = debouncedQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            {t("addItem")}
          </Button>
        </div>
      </div>
      <CatalogSectionNav active="catalog" />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("newItem")}>
        <CatalogForm
          onDone={(created, options) => {
            setShowForm(false);
            // Guided combo creation: jump straight into composition instead of
            // leaving the user to find the card button. No nested modals (the
            // form modal closes first).
            if (created && options?.openCombo) setComboItem(created);
          }}
        />
      </Modal>

      <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editItem")}>
        {editingItem && <CatalogForm item={editingItem} onDone={() => setEditingItem(null)} />}
      </Modal>

      <Modal open={!!formulaItem} onClose={() => setFormulaItem(null)} title={t("formulaTitle")}>
        {formulaItem && (
          <ProductFormulaForm
            key={`${formulaItem.id}:${formulaItem.formulaVersions.at(-1)?.version ?? 0}`}
            item={formulaItem}
            catalogItems={items}
            onDone={() => setFormulaItem(null)}
          />
        )}
      </Modal>

      <Modal open={!!comboItem} onClose={() => setComboItem(null)} title={t("comboTitle")}>
        {comboItem && (
          <ProductComboForm
            key={`${comboItem.id}:${comboItem.comboVersions.at(-1)?.version ?? 0}`}
            item={comboItem}
            catalogItems={items}
            onDone={() => setComboItem(null)}
          />
        )}
      </Modal>

      {/* Search input */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon icon={Search} size="sm" className="text-zinc-400" />
            </div>
            <input
              type="text"
              aria-label={t("search")}
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-surface-border bg-surface-input py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-card dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          {/* Unified empty state (H-10 residue): zero matches are presented
              exclusively by the EmptyState below — the counter renders only
              for non-empty results. */}
          {!(debouncedQuery.trim() && filteredItems.length === 0) && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {debouncedQuery.trim()
                ? t("results", { count: String(filteredItems.length), total: String(items.length) })
                : t("results", { count: String(items.length), total: String(items.length) })}
            </p>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Package} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Search} size="xl" />}
          title={t("noResults")}
          description={t("search")}
        />
      ) : (
        <div className={CATALOG_GRID_CLASSES}>
          {filteredItems.map((item) => {
            const currency = item.unitPrice.currency;

            return (
              <CatalogItemCard
                key={item.id}
                id={item.id}
                highlighted={highlightItemId === item.id}
                name={item.name}
                type={item.type}
                typeLabel={
                  item.type === "product"
                    ? item.comboVersions.length > 0
                      ? t("comboProduct")
                      : item.formulaVersions.length > 0
                        ? t("preparedProduct")
                        : t(`productRole_${item.productRole}`)
                    : t(`type_${item.type}`)
                }
                priceLabel={t("unitPriceLabel")}
                price={
                  item.productRole === "supply"
                    ? t("notForSale")
                    : formatAmount(item.unitPrice.amount, currency, locale)
                }
                priceUnit={
                  item.productRole === "supply"
                    ? t("supplyPriceHint")
                    : item.comboVersions.length > 0
                      ? t("perCombo")
                      : t("perUnit", { unit: t(`unit_${item.saleUnit}`) })
                }
                stockLabel={item.comboVersions.length > 0 ? t("comboAvailability") : t("stock")}
                stock={
                  item.type !== "product" || item.stock === undefined
                    ? null
                    : item.comboVersions.length > 0
                      ? new Intl.NumberFormat(locale).format(
                          getAvailableComboCount(item.comboVersions.at(-1)!, stockByItemId),
                        )
                      : new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
                          quantityFromBaseUnits(item.stock, item.saleUnit),
                        )
                }
                stockUnit={
                  item.comboVersions.length > 0 ? t("comboUnit") : t(`unit_${item.saleUnit}`)
                }
                notApplicable={t("notApplicableStock")}
                actions={
                  <>
                    {item.type === "product" && item.comboVersions.length === 0 ? (
                      <StockControls item={item} icon={ArrowDownUp} />
                    ) : (
                      <span data-card-action-placeholder aria-hidden="true" />
                    )}
                    {item.type === "product" &&
                    item.productRole !== "supply" &&
                    item.comboVersions.length === 0 ? (
                      <ActionIconButton
                        icon={ChefHat}
                        label={t("formulaTitle")}
                        tone="neutral"
                        onClick={() => setFormulaItem(item)}
                      />
                    ) : (
                      <span data-card-action-placeholder aria-hidden="true" />
                    )}
                    {item.type === "product" &&
                    item.productRole !== "supply" &&
                    item.formulaVersions.length === 0 &&
                    (item.comboVersions.length > 0 ||
                      (item.stock === 0 && item.saleUnit === "unit")) ? (
                      <ActionIconButton
                        icon={PackagePlus}
                        label={t("comboTitle")}
                        tone="neutral"
                        onClick={() => setComboItem(item)}
                      />
                    ) : (
                      <span data-card-action-placeholder aria-hidden="true" />
                    )}
                    <ActionIconButton
                      icon={Pencil}
                      label={t("edit")}
                      tone="primary"
                      onClick={() => setEditingItem(item)}
                    />
                    <DeleteCatalogItemButton itemId={item.id} />
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
