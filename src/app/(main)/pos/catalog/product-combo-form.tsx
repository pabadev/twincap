"use client";

import { useActionState, useEffect, useState } from "react";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import { getUnitFactorToBase } from "../../../../core/domain/inventory-units";
import { useT } from "../../../../i18n/client";
import { useActionError } from "../../../../lib/use-action-error";
import { Alert } from "../../../../components/ui/alert";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { configureProductComboAction } from "./actions";

type ComboLine = { itemId: string; quantity: string };

export function ProductComboForm({
  item,
  catalogItems,
  onDone,
}: {
  item: SerializedCatalogItem;
  catalogItems: SerializedCatalogItem[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(configureProductComboAction, null);
  const t = useT("Catalog");
  const translateError = useActionError();
  const components = catalogItems.filter(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.type === "product" &&
      candidate.productRole !== "supply" &&
      candidate.comboVersions.length === 0,
  );
  const latest = item.comboVersions.at(-1);
  const [lines, setLines] = useState<ComboLine[]>(
    latest?.components.map((component) => ({
      itemId: component.itemId,
      quantity: String(component.quantity),
    })) ?? [{ itemId: components[0]?.id ?? "", quantity: "1" }],
  );

  useEffect(() => {
    if (state?.success) onDone();
  }, [state?.success, onDone]);

  function quantityStep(itemId: string): string {
    const unit = components.find((component) => component.id === itemId)?.saleUnit ?? "unit";
    const factor = getUnitFactorToBase(unit);
    return factor >= 1000 ? "0.001" : factor === 10 ? "0.1" : "1";
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="itemId" value={item.id} />
      <input
        type="hidden"
        name="combo"
        value={JSON.stringify({
          components: lines.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unit: components.find((component) => component.id === line.itemId)?.saleUnit,
          })),
        })}
      />
      {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}
      {latest && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {t("comboVersion", { version: String(latest.version) })}
        </p>
      )}
      <p className="text-xs text-zinc-500">{t("comboFixedHint")}</p>
      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
          <Select
            id={`combo-component-${index}`}
            label={t("comboComponent")}
            className="h-10"
            required
            placeholder={t("receiptItem")}
            value={line.itemId}
            options={components
              .filter(
                (component) =>
                  component.id === line.itemId ||
                  !lines.some((entry, row) => row !== index && entry.itemId === component.id),
              )
              .map((component) => ({
                value: component.id,
                label: `${component.name} · ${t(`unit_${component.saleUnit}`)}`,
              }))}
            onChange={(event) =>
              setLines((current) =>
                current.map((entry, row) =>
                  row === index ? { ...entry, itemId: event.target.value } : entry,
                ),
              )
            }
          />
          <label className="space-y-1 text-sm">
            <span>{t("quantity")}</span>
            <Input
              type="number"
              min={quantityStep(line.itemId)}
              step={quantityStep(line.itemId)}
              required
              value={line.quantity}
              onChange={(event) =>
                setLines((current) =>
                  current.map((entry, row) =>
                    row === index ? { ...entry, quantity: event.target.value } : entry,
                  ),
                )
              }
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={lines.length < 2 || pending}
            onClick={() => setLines((current) => current.filter((_, row) => row !== index))}
          >
            {t("receiptRemoveLine")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={components.length <= lines.length || pending}
        onClick={() => {
          const unused = components.find(
            (component) => !lines.some((line) => line.itemId === component.id),
          );
          if (unused) setLines((current) => [...current, { itemId: unused.id, quantity: "1" }]);
        }}
      >
        {t("receiptAddLine")}
      </Button>
      <Button type="submit" disabled={pending || components.length === 0}>
        {pending ? t("savingAdjustment") : t("comboSave")}
      </Button>
    </form>
  );
}
