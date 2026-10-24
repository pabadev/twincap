"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../../i18n/client";
import { updateSaleAction } from "./actions";
import { MoneyInput } from "../../../../components/ui/money-input";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";

interface SaleEditLine {
  itemName: string | null;
  quantity: number;
  unit: string;
  unitPrice: { amount: number; currency: string };
}

/**
 * DOM-1 (EXC-2): per-line unit-price edit for a registered sale. Quantities
 * and inventory snapshots are NOT editable (consumption reversal is out of
 * scope in v1) — only prices move, and the use case cascades the change to
 * the income movement or the linked credit.
 */
export function EditSalePricesForm({
  saleId,
  currency,
  lines,
  version,
  onDone,
}: {
  saleId: string;
  currency: string;
  lines: SaleEditLine[];
  /** CAS guard: the version the modal READ (from the detail snapshot). */
  version?: number;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateSaleAction, null);
  const t = useT("Sales");
  const tCatalog = useT("Catalog");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);
  // Raw strings (tolerant money input contract): the server parses them with
  // parseMoneyInput + decimalAmountToMinorUnits — never Number() here.
  const [prices, setPrices] = useState<string[]>(() =>
    lines.map((line) => String(line.unitPrice.amount)),
  );

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      onDone();
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  // U1 error one-shot guard (see use-action-error.ts): memoize per error VALUE.
  const lastErrorShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (state?.error && state.error !== lastErrorShownRef.current) {
      lastErrorShownRef.current = state.error;
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="saleId" value={saleId} />
      {/* Currency lives on the sale's account; sent as-is to satisfy the
          use-case DTO — it is not independently editable (ACC-1). */}
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="version" value={version ?? ""} />
      <input type="hidden" name="unitPrices" value={JSON.stringify(prices)} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("editPricesHelp")}</p>

      {lines.map((line, index) => (
        <MoneyInput
          key={index}
          id={`sale-price-${index}`}
          name={`price-${index}`}
          label={`${line.itemName ?? t("itemDeleted")} — ${line.quantity} × ${tCatalog(`unit_${line.unit}`)}`}
          currency={currency}
          min={1}
          required
          value={prices[index]}
          onChange={(e) => {
            setPrices((prev) => prev.map((v, i) => (i === index ? e.target.value : v)));
          }}
          disabled={isPending}
        />
      ))}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
          {isPending ? t("updating") : tCommon("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
