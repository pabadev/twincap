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
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Trash2 } from "lucide-react";
import { configureProductFormulaAction } from "./actions";

type FormulaLine = { itemId: string; quantity: string };

export function ProductFormulaForm({
  item,
  catalogItems,
  onDone,
}: {
  item: SerializedCatalogItem;
  catalogItems: SerializedCatalogItem[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(configureProductFormulaAction, null);
  const t = useT("Catalog");
  const translateError = useActionError();
  const supplies = catalogItems.filter(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.type === "product" &&
      candidate.productRole !== "sellable",
  );
  const latest = item.formulaVersions.at(-1);
  const [yieldQuantity, setYieldQuantity] = useState(String(latest?.yieldQuantity ?? 1));
  const [lines, setLines] = useState<FormulaLine[]>(
    latest?.components.map((component) => ({
      itemId: component.itemId,
      quantity: String(component.quantity),
    })) ?? [{ itemId: supplies[0]?.id ?? "", quantity: "1" }],
  );
  const yieldFactor = getUnitFactorToBase(item.saleUnit);
  const yieldStep = yieldFactor >= 1000 ? "0.001" : yieldFactor === 10 ? "0.1" : "1";
  useEffect(() => {
    if (state?.success) onDone();
  }, [state?.success, onDone]);
  function quantityStep(itemId: string): string {
    const unit = supplies.find((supply) => supply.id === itemId)?.saleUnit ?? "unit";
    const factor = getUnitFactorToBase(unit);
    return factor >= 1000 ? "0.001" : factor === 10 ? "0.1" : "1";
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="itemId" value={item.id} />
      <input
        type="hidden"
        name="formula"
        value={JSON.stringify({
          yieldQuantity: Number(yieldQuantity),
          yieldUnit: item.saleUnit,
          components: lines.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unit: supplies.find((supply) => supply.id === line.itemId)?.saleUnit,
          })),
        })}
      />
      {state?.error && <Alert variant="danger">{translateError(state.error)}</Alert>}
      {latest && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {t("formulaVersion", { version: String(latest.version) })}
        </p>
      )}
      <label className="block space-y-1 text-sm">
        <span>{t("formulaYield", { unit: t(`unit_${item.saleUnit}`) })}</span>
        <Input
          type="number"
          min={yieldStep}
          step={yieldStep}
          required
          value={yieldQuantity}
          onChange={(event) => setYieldQuantity(event.target.value)}
        />
      </label>
      <p className="text-xs text-zinc-500">{t("formulaScaleHint")}</p>
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
            <Select
              id={`formula-component-${index}`}
              label={t("formulaComponent")}
              className="h-10"
              required
              placeholder={t("receiptItem")}
              value={line.itemId}
              options={supplies
                .filter(
                  (supply) =>
                    supply.id === line.itemId ||
                    !lines.some((entry, row) => row !== index && entry.itemId === supply.id),
                )
                .map((supply) => ({
                  value: supply.id,
                  label: `${supply.name} · ${t(`unit_${supply.saleUnit}`)}`,
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
            {/* Icon-only remove action (owner rule: TwinCap action rows are
                icon-first, like sales/movements/receipts). */}
            <ActionIconButton
              icon={Trash2}
              label={t("receiptRemoveLine")}
              tone="danger"
              disabled={lines.length < 2 || pending}
              onClick={() => setLines((current) => current.filter((_, row) => row !== index))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={supplies.length <= lines.length || pending}
          onClick={() => {
            const unused = supplies.find(
              (supply) => !lines.some((line) => line.itemId === supply.id),
            );
            if (unused) setLines((current) => [...current, { itemId: unused.id, quantity: "1" }]);
          }}
        >
          {t("receiptAddLine")}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">{t("formulaVersioningHint")}</p>
      <Button type="submit" disabled={pending || supplies.length === 0}>
        {pending ? t("savingAdjustment") : t("formulaSave")}
      </Button>
    </form>
  );
}
