"use client";

import { useState, useActionState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../i18n/client";
import { setInitialBalanceAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../components/ui/money-action-confirmation";
import { useMoneyActionConfirmation } from "../../../lib/use-money-action-confirmation";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { DEFAULT_CURRENCY } from "../../../core/domain/currency";
import type { Currency } from "../../../core/domain/currency";
import { formatAmount } from "../../../lib/format";

export function InitialBalanceButton({
  accountId,
  currency,
}: {
  accountId: string;
  currency?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(setInitialBalanceAction, null);
  const t = useT("Accounts");
  const tToast = useT("Toast");
  const tConfirm = useT("MoneyConfirmation");
  const tCommon = useT("Common");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();

  // UX-6 informed confirmation (binding): the submit ALWAYS opens the
  // confirmation dialog; confirming re-dispatches the captured FormData with
  // the SAME idempotency key (never regenerated); cancel leaves the form
  // populated and dispatches nothing. The native `action={formAction}`
  // binding is preserved (R15.3.1 hybrid — dispatch happens ONLY from the
  // dialog's confirm button). The success effect below — closing the modal —
  // is untouched.
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleConfirm, handleCancel } =
    useMoneyActionConfirmation(formRef, formAction, isPending);
  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);
  const [confirmAmount, setConfirmAmount] = useState(0);

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), "success");
      router.refresh();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacción al resultado de server action (useActionState); cierra el modal al completar. Refactorizar derivaría el estado en render y no es aplicable aquí.
      setShowForm(false);
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  // The row is read from the CURRENT DOM value (uncontrolled input) at submit
  // time and stored in state so the opened dialog renders it. The raw amount
  // is kept separately: the description template interpolates the FORMATTED
  // amount, which cannot be derived back from the formatted row value.
  const buildConfirmDetails = (): ConfirmationDetailRow[] => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const amount = Number(fd?.get("amount") ?? 0);
    setConfirmAmount(amount);
    return [
      {
        label: t("balanceToSet"),
        value: formatAmount(amount, currency ?? DEFAULT_CURRENCY, locale),
      },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(true)}>
        {t("setInitialBalance")}
      </Button>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("setInitialBalance")}>
        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <IdempotencyField />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("setInitialBalanceDescription")}
          </p>
          <Input
            id="amount"
            name="amount"
            type="number"
            label={t("balanceToSet")}
            min="1"
            required
            disabled={isPending}
          />
          <input type="hidden" name="accountId" value={accountId} />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isPending}
            loading={isPending}
          >
            {isPending ? t("saving") : t("setInitialBalance")}
          </Button>
        </form>

        <MoneyActionConfirmation
          open={isConfirmOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={tConfirm("setInitialBalanceTitle")}
          description={tConfirm("setInitialBalanceDescription", {
            amount: formatAmount(confirmAmount, currency ?? DEFAULT_CURRENCY, locale),
          })}
          confirmLabel={tConfirm("confirm")}
          cancelLabel={tCommon("cancel")}
          variant="normal"
          detailRows={confirmDetails}
          loading={isPending}
        />
      </Modal>
    </>
  );
}
