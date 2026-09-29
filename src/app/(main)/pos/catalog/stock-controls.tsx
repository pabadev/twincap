"use client";

import { useActionState, useEffect, useState } from "react";
import type { SerializedCatalogItem } from "../../../../core/domain/catalog";
import { quantityFromBaseUnits } from "../../../../core/domain/inventory-units";
import { useLocale, useT } from "../../../../i18n/client";
import { ActionIconButton } from "../../../../components/ui/action-icon-button";
import { Button } from "../../../../components/ui/button";
import { Modal } from "../../../../components/ui/modal";
import { adjustCatalogStockAction, getCatalogStockHistoryAction } from "./actions";
import type { LucideIcon } from "lucide-react";

type HistoryEntry = { id: string; delta: number; kind: string; reason: string; createdAt: Date };

export function StockControls({ item, icon }: { item: SerializedCatalogItem; icon: LucideIcon }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [state, formAction, pending] = useActionState(adjustCatalogStockAction, null);
  const t = useT("Catalog");
  const locale = useLocale();

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getCatalogStockHistoryAction(item.id).then((result) => {
      if (active && "history" in result) setHistory(result.history);
    });
    return () => {
      active = false;
    };
  }, [open, item.id, state?.success]);

  return (
    <>
      {/* Icon trigger (sales/movements action-row pattern): the card footer
          packs up to 5 actions, so a full-width labelled button overflows.
          The label stays accessible via aria-label + title. */}
      <ActionIconButton
        icon={icon}
        label={t("adjustStock")}
        tone="neutral"
        onClick={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} title={t("adjustStock")}>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="itemId" value={item.id} />
          <label className="block text-sm">
            {t("adjustmentType")}
            <select
              name="direction"
              className="mt-1 w-full rounded-md border border-surface-border bg-surface-input p-2"
            >
              <option value="in">{t("stockIn")}</option>
              <option value="out">{t("stockOut")}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("quantity")}
            <input
              name="quantity"
              type="number"
              // min must sit ON the step grid (min = one step, or 0 whole
              // units): with min=0.001 + step=1 the browser only accepts
              // 0.001, 1.001, 2.001… and rejects the integer 2.
              min={item.saleUnit === "unit" ? "1" : "0.001"}
              step={item.saleUnit === "unit" ? "1" : "0.001"}
              required
              className="mt-1 w-full rounded-md border border-surface-border bg-surface-input p-2"
            />
          </label>
          <label className="block text-sm">
            {t("reason")}
            <input
              name="reason"
              maxLength={160}
              required
              className="mt-1 w-full rounded-md border border-surface-border bg-surface-input p-2"
            />
          </label>
          {state?.error && (
            <p role="alert" className="text-sm text-red-600">
              {t("adjustmentError")}
            </p>
          )}
          {state?.success && (
            <p role="status" className="text-sm text-green-700">
              {t("adjustmentSaved")}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? t("savingAdjustment") : t("saveAdjustment")}
          </Button>
        </form>
        <section className="mt-6 space-y-2" aria-label={t("stockHistoryTitle")}>
          <h3 className="font-medium">{t("stockHistoryTitle")}</h3>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("noStockHistory")}</p>
          ) : (
            history.map((entry) => {
              const quantity = quantityFromBaseUnits(Math.abs(entry.delta), item.saleUnit);
              const date = new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(entry.createdAt));
              return (
                <div key={entry.id} className="rounded-md border border-surface-border p-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{t(`stockKind_${entry.kind}`)}</span>
                    <strong>
                      {entry.delta > 0 ? "+" : "−"}
                      {new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
                        quantity,
                      )}{" "}
                      {t(`unit_${item.saleUnit}`)}
                    </strong>
                  </div>
                  <div className="text-zinc-500">
                    {date}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </Modal>
    </>
  );
}
