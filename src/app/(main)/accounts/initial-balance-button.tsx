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
  // confirmation dialog; confirming re-dispatches the SAME form data with the
  // SAME idempotency key (never regenerated); cancel leaves the form
  // populated and dispatches nothing. The native `action={formAction}`
  // binding is preserved (R15.3.1 hybrid — dispatch happens ONLY from the
  // dialog's confirm button). The success effect below — closing the modal —
  // is untouched.
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleCancel } = useMoneyActionConfirmation(
    formRef,
    formAction,
    isPending,
  );

  // R15.3.1 regression fix (same bug class transfer-form.tsx documents):
  // an imperative `formAction(fd)` dispatch from the nested confirmation was
  // the ONLY dispatch of this flow (UX-6 always confirms, so no native first
  // submit ever ran). Such manual dispatch races the App Router: the router
  // starts a route transition (loading.tsx + display:none on the old tree —
  // the /accounts page segment goes display:none, so the outer modal asserts
  // hidden SPURIOUSLY) and defers the action fetch (trace: POST created,
  // send:-1; here measured at ~10s completion) — any navigation in that
  // window aborts the POST and the initial balance is silently lost.
  // Confirming via a NATIVE submission (requestSubmit) keeps the router in
  // action context: the request is sent immediately and the write lands
  // before any navigation can abort it. The one-shot guard lets the native
  // action={formAction} binding run ONLY for the confirmed re-submission;
  // any other submit is still intercepted and always re-confirmed (UX-6).
  const confirmedRef = useRef(false);
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
    if (confirmedRef.current) {
      // Confirmed re-submission: one-shot guard consumed — do NOT intercept;
      // the native `action={formAction}` binding dispatches (R15.3.1).
      confirmedRef.current = false;
      return;
    }
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  // R15.3.1: re-submit the form NATIVELY instead of dispatching captured
  // FormData imperatively (see the comment above). The mounted form still
  // carries exactly the fields the user confirmed (amount + accountId + the
  // mount-scoped idempotency key — never regenerated). The dialog stays open
  // while pending: loading disables its buttons and neutralizes its close.
  const handleConfirm = () => {
    if (isPending) return;
    confirmedRef.current = true;
    formRef.current?.requestSubmit();
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
        </form>
      </Modal>
    </>
  );
}
