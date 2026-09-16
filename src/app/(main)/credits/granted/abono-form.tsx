"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../../i18n/client";
import { addAbonoAction } from "./actions";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../../components/ui/money-action-confirmation";
import { useMoneyActionConfirmation } from "../../../../lib/use-money-action-confirmation";
import type { SerializedAccount } from "../../../../core/domain/account";
import { formatAmount, formatDate } from "../../../../lib/format";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";
import { toDateInputValue } from "../../../../lib/date";

export function AbonoForm({
  creditId,
  pending,
  currency,
  accounts,
}: {
  creditId: string;
  pending: number;
  currency: string;
  accounts: SerializedAccount[];
}) {
  const [state, formAction, isPending] = useActionState(addAbonoAction, null);
  const t = useT("CreditsGranted");
  const tCommon = useT("Common");
  const tConfirm = useT("MoneyConfirmation");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // UX-6 informed confirmation (binding): the submit ALWAYS opens the
  // confirmation dialog; confirming re-dispatches the captured FormData with
  // the SAME idempotency key (never regenerated); cancel leaves the form
  // populated and dispatches nothing. The native `action={formAction}`
  // binding is preserved (R15.3.1 hybrid — dispatch happens ONLY from the
  // dialog's confirm button).
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleConfirm, handleCancel } =
    useMoneyActionConfirmation(formRef, formAction, isPending);
  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router]);

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
      { label: t("pending"), value: formatAmount(pending, currency, locale) },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-surface-border bg-surface-bg p-4 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="currency" value={currency} />

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("pending")} {formatAmount(pending, currency, locale)}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          id={`amount-${creditId}`}
          name="amount"
          type="number"
          label={t("amount")}
          min="1"
          max={pending}
          required
          disabled={isPending}
        />

        <Select
          id={`accountId-${creditId}`}
          name="accountId"
          label={t("account")}
          required
          disabled={isPending}
          placeholder={tCommon("select")}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />

        <Input
          id={`date-${creditId}`}
          name="date"
          type="date"
          label={t("date")}
          required
          disabled={isPending}
          defaultValue={toDateInputValue()}
          max={toDateInputValue()}
        />
      </div>

      <Button type="submit" variant="success" size="sm" disabled={isPending} loading={isPending}>
        {isPending ? t("adding") : t("addAbono")}
      </Button>

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
