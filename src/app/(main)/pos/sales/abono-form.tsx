"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../../i18n/client";
import { useActionError } from "../../../../lib/use-action-error";
import { addSaleAbonoAction } from "./actions";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../../components/ui/money-action-confirmation";
import { useMoneyActionConfirmation } from "../../../../lib/use-money-action-confirmation";
import type { SerializedAccount } from "../../../../core/domain/account";
import { DEFAULT_CURRENCY } from "../../../../core/domain/currency";
import type { Currency } from "../../../../core/domain/currency";
import { formatAmount, formatDate } from "../../../../lib/format";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { toDateInputValue } from "../../../../lib/date";

interface AbonoFormProps {
  saleId: string;
  accounts: SerializedAccount[];
  /** Remaining amount of the sale before this abono (UX-6 detail row). */
  pending?: number;
  onDone?: () => void;
}

export function AbonoForm({ saleId, accounts, pending, onDone }: AbonoFormProps) {
  const [state, formAction, isPending] = useActionState(addSaleAbonoAction, null);
  const t = useT("Sales");
  const tCommon = useT("Common");
  const tConfirm = useT("MoneyConfirmation");
  const tToast = useT("Toast");
  const locale = useLocale();
  // I8: addSaleAbonoAction returns error.* i18n keys — resolve them here.
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const currency: Currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;

  // UX-6 informed confirmation (binding): the submit ALWAYS opens the
  // confirmation dialog; the former re-entrant isPending guard is now inside
  // the SHARED hook's interceptSubmit; confirming re-dispatches the captured
  // FormData with the SAME idempotency key; cancel leaves the form populated
  // and dispatches nothing. The native `action={formAction}` binding is
  // preserved (R15.3.1 hybrid — dispatch happens ONLY from the dialog's
  // confirm button). `onDone` (modal close) is untouched.
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleConfirm, handleCancel } =
    useMoneyActionConfirmation(formRef, formAction, isPending);
  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onDone?.();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  // The rows are read from the CURRENT DOM values (uncontrolled inputs) at
  // submit time and stored in state so the opened dialog renders them.
  const buildConfirmDetails = (): ConfirmationDetailRow[] => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const amount = Number(fd?.get("amount") ?? 0);
    const accountId = String(fd?.get("accountId") ?? "");
    const date = String(fd?.get("date") ?? toDateInputValue());
    const account = accounts.find((a) => a.id === accountId);
    return [
      { label: t("amount"), value: formatAmount(amount, currency, locale) },
      { label: t("account"), value: account?.name ?? accountId },
      { label: t("date"), value: formatDate(date, locale) },
      { label: t("pending"), value: formatAmount(pending ?? 0, currency, locale) },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="currency" value={currency} />

      {state?.error && (
        <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {translateError(state.error)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="amount"
          name="amount"
          type="number"
          label={`${t("amount")} (${currency})`}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="accountId"
          name="accountId"
          label={t("account")}
          required
          disabled={isPending}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />

        <Input
          id="date"
          name="date"
          type="date"
          label={t("date")}
          required
          disabled={isPending}
          defaultValue={toDateInputValue()}
          max={toDateInputValue()}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="success" disabled={isPending} loading={isPending}>
          {isPending ? t("adding") : t("addPaymentBtn")}
        </Button>
        {onDone && (
          <Button type="button" variant="secondary" disabled={isPending} onClick={onDone}>
            {tCommon("cancel")}
          </Button>
        )}
      </div>

      <MoneyActionConfirmation
        open={isConfirmOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={tConfirm("confirmAbonoTitle")}
        confirmLabel={tConfirm("confirm")}
        cancelLabel={tCommon("cancel")}
        variant="destination-account"
        detailRows={confirmDetails}
        loading={isPending}
      />
    </form>
  );
}
