"use client";

import { useState, useActionState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../i18n/client";
import { correctInitialBalanceAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../components/ui/money-action-confirmation";
import { useMoneyActionConfirmation } from "../../../lib/use-money-action-confirmation";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { TouchTarget } from "../../../components/ui/touch-target";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { DEFAULT_CURRENCY } from "../../../core/domain/currency";
import { formatAmount } from "../../../lib/format";
import { RotateCcw } from "lucide-react";

export function CorrectInitialBalanceButton({
  accountId,
  currency,
}: {
  accountId: string;
  currency?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(correctInitialBalanceAction, null);
  const t = useT("Accounts");
  const tToast = useT("Toast");
  const tConfirm = useT("MoneyConfirmation");
  const tCommon = useT("Common");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();

  // Same UX-6 confirmation pattern as InitialBalanceButton: the submit ALWAYS
  // opens the confirmation dialog; confirming re-dispatches via native
  // requestSubmit (R15.3.1); cancel leaves the form populated.
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleCancel } = useMoneyActionConfirmation(
    formRef,
    formAction,
    isPending,
  );

  const confirmedRef = useRef(false);
  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);
  const [confirmAmount, setConfirmAmount] = useState(0);
  const [awaitingResult, setAwaitingResult] = useState(false);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacción al resultado de server action (useActionState); cierra el modal al completar.
      setShowForm(false);
      addToast(tToast(state.success), "success");
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacción al resultado de server action (useActionState); reabre la confirmación al fallar.
      setAwaitingResult(false);
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  const buildConfirmDetails = (): ConfirmationDetailRow[] => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const amount = Number(fd?.get("newAmount") ?? 0);
    setConfirmAmount(amount);
    return [
      {
        label: t("newBalance"),
        value: formatAmount(amount, currency ?? DEFAULT_CURRENCY, locale),
      },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  const handleConfirm = () => {
    if (isPending || awaitingResult) return;
    setAwaitingResult(true);
    confirmedRef.current = true;
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <ActionIconButton
        icon={RotateCcw}
        label={t("correctInitialBalance")}
        tone="primary"
        onClick={() => {
          setAwaitingResult(false);
          setShowForm(true);
        }}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("correctInitialBalance")}>
        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <IdempotencyField />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("correctInitialBalanceDescription")}
          </p>
          <Input
            id="newAmount"
            name="newAmount"
            type="number"
            label={t("newBalance")}
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
            {isPending ? t("saving") : t("correctInitialBalance")}
          </Button>

          <MoneyActionConfirmation
            open={isConfirmOpen && !awaitingResult}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            title={tConfirm("correctInitialBalanceTitle")}
            description={tConfirm("correctInitialBalanceDescription", {
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
