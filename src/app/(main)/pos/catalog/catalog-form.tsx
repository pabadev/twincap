"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "../../../../i18n/client";
import { createCatalogItemAction, updateCatalogItemAction } from "./actions";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import { CATALOG_ITEM_TYPES, PRODUCT_ROLES } from "../../../../core/domain/catalog";
import type { CatalogItemType, ProductRole } from "../../../../core/domain/catalog";
import { INVENTORY_UNITS, quantityFromBaseUnits } from "../../../../core/domain/inventory-units";
import type { InventoryUnit } from "../../../../core/domain/inventory-units";
import { CURRENCIES } from "../../../../core/domain/currency";
import type { Currency } from "../../../../core/domain/currency";
import { Input } from "../../../../components/ui/input";
import { Alert } from "../../../../components/ui/alert";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";

interface CatalogFormProps {
  item?: SerializedCatalogItem;
  /** Called after a successful save; a create passes the created item snapshot (when available). */
  onDone?: (item?: SerializedCatalogItem, options?: { openCombo?: boolean }) => void;
}

/**
 * Form-only "kind" selector: regular products and services map 1:1 to the
 * domain types; "combo" is a guided preset that fixes type=product,
 * productRole=sellable, saleUnit=unit, stock=0 — exactly the shape
 * configureProductCombo requires — so a new user never has to know those
 * rules. The domain stays untouched.
 */
type CatalogKind = CatalogItemType | "combo";

export function CatalogForm({ item, onDone }: CatalogFormProps) {
  const isEdit = !!item;
  const t = useT("Catalog");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const locale = useLocale();
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateCatalogItemAction : createCatalogItemAction,
    null,
  );

  // Neutral defaults (founder rule): every form select opens on "Seleccionar"
  // unless editing an existing record (its persisted value is the truth, not a
  // choice). The guided combo preset still fixes the domain shape via hidden
  // inputs — only the visible choice is neutral.
  const [kind, setKind] = useState<CatalogKind | "">(item?.type ?? "");
  const [saleUnit, setSaleUnit] = useState<InventoryUnit | "">(item?.saleUnit ?? "");
  const [productRole, setProductRole] = useState<ProductRole | "">(item?.productRole ?? "");
  const [currency, setCurrency] = useState<Currency | "">(item?.unitPrice.currency ?? "");
  const resolvedType: CatalogItemType = kind === "combo" || kind === "" ? "product" : kind;

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      // The consumer MUST act before router.refresh(): a refresh suspends the
      // page and loading.tsx remounts the tree, destroying this form's and the
      // consumer's client state. Firing onDone first lets the consumer open a
      // follow-up modal (guided combo) in the same commit.
      onDone?.(state.item, { openCombo: !isEdit && kind === "combo" });
      router.refresh();
    }
  }, [state?.success, state?.item, addToast, tToast, router, onDone, isEdit, kind]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (isPending) {
          e.preventDefault();
          return;
        }
      }}
      className="space-y-4"
    >
      {isEdit && <input type="hidden" name="itemId" value={item.id} />}

      {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}

      <Input
        id="name"
        name="name"
        type="text"
        label={t("name")}
        placeholder={t("namePlaceholder")}
        required
        defaultValue={item?.name}
        disabled={isPending}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {kind === "product" && productRole === "supply" ? (
          <>
            <input type="hidden" name="unitPrice" value="0" />
            <p className="self-center text-sm text-zinc-600 dark:text-zinc-400">
              {t("supplyPriceHint")}
            </p>
          </>
        ) : (
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            label={currency ? t("unitPrice", { currency }) : t("unitPricePlain")}
            min="1"
            required
            defaultValue={item?.unitPrice.amount}
            disabled={isPending}
          />
        )}
        <Select
          id="currency"
          name="currency"
          label={t("currency")}
          required
          disabled={isPending || isEdit}
          value={currency}
          placeholder={tCommon("select")}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* UI-only kind selector (no name): the server contract still receives
            type=product|service via the hidden input below. "Combo" presets
            the exact shape configureProductCombo requires. */}
        <div>
          <Select
            id="type"
            label={t("type")}
            required
            disabled={isPending || isEdit}
            value={kind}
            placeholder={isEdit ? undefined : tCommon("select")}
            onChange={(e) => setKind(e.target.value as CatalogKind)}
            options={
              isEdit
                ? CATALOG_ITEM_TYPES.map((ct) => ({
                    value: ct,
                    label: t(`type_${ct}`),
                  }))
                : [
                    ...CATALOG_ITEM_TYPES.map((ct) => ({
                      value: ct,
                      label: t(`type_${ct}`),
                    })),
                    { value: "combo", label: t("type_combo") },
                  ]
            }
          />
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {kind ? t(`typeHint_${kind}`) : t("typeHint_none")}
          </p>
        </div>
        <input type="hidden" name="type" value={resolvedType} />

        {kind === "combo" && (
          <>
            <input type="hidden" name="productRole" value="sellable" />
            <input type="hidden" name="saleUnit" value="unit" />
            {!isEdit && <input type="hidden" name="stock" value="0" />}
          </>
        )}

        {kind === "product" && (
          <Select
            id="saleUnit"
            name="saleUnit"
            label={t("saleUnit")}
            required
            disabled={isPending || isEdit}
            value={saleUnit}
            placeholder={tCommon("select")}
            onChange={(e) => setSaleUnit(e.target.value as InventoryUnit)}
            options={INVENTORY_UNITS.map((unit) => ({
              value: unit,
              label: t(`unit_${unit}`),
            }))}
          />
        )}

        {kind === "product" && (
          <Select
            id="productRole"
            name="productRole"
            label={t("productRole")}
            required
            disabled={isPending || (item?.comboVersions.length ?? 0) > 0}
            value={productRole}
            placeholder={tCommon("select")}
            onChange={(e) => setProductRole(e.target.value as ProductRole)}
            options={PRODUCT_ROLES.map((role) => ({
              value: role,
              label: t(`productRole_${role}`),
            }))}
          />
        )}
        {kind === "product" && (item?.comboVersions.length ?? 0) > 0 && (
          <p className="text-xs text-zinc-500">{t("comboRoleHint")}</p>
        )}

        {kind === "product" && !isEdit && (
          <Input
            id="stock"
            name="stock"
            type="number"
            label={t("initialStock")}
            min="0"
            step="0.001"
            required
            defaultValue={0}
            disabled={isPending}
          />
        )}
      </div>

      {kind === "product" && saleUnit && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {productRole === "supply"
            ? t("supplyAndStockUnitHint", { unit: t(`unit_${saleUnit}`) })
            : t("priceAndStockUnitHint", { unit: t(`unit_${saleUnit}`) })}
          {isEdit && item?.stock !== undefined && (
            <>
              {" "}
              {t("currentStock", {
                quantity: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
                  quantityFromBaseUnits(item.stock, saleUnit),
                ),
                unit: t(`unit_${saleUnit}`),
              })}
            </>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
          {isPending
            ? isEdit
              ? t("updating")
              : t("creating")
            : isEdit
              ? t("updateItem")
              : t("addBtn")}
        </Button>
        {isEdit && onDone && (
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => onDone()}>
            {tCommon("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
