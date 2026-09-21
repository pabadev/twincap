"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../i18n/client";
import { createTransferAction, updateTransferAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import type { SerializedAccount } from "../../../core/domain/account";
import type { SerializedTransfer } from "../../../core/domain/transfer";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { businessDateToInputValue, toDateInputValue } from "../../../lib/date";
import { formatAmount } from "../../../lib/format";
import { exponentOf, DEFAULT_CURRENCY } from "../../../core/domain/currency";

/**
 * Action-state shape shared by the create/edit transfer actions.
 * `warning` is produced by createTransferAction (R15.1 Fase 5) and, since
 * R15.2 Fase D (D1), by updateTransferAction too when a balance-affecting
 * edit projects a negative source balance without confirmation — the shared
 * confirm modal below handles both. The `type` discriminator keeps the
 * warning payload future-proof for additional warning flavors.
 */
type TransferFormState = {
  error?: string;
  success?: string;
  warning?: {
    type: "insufficient_funds";
    currentBalance: number;
    projectedBalance: number;
    currency: string;
  };
};

export function TransferForm({
  accounts,
  transfer,
  defaultCurrency,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  /** Present → edit mode (prefills fields and calls updateTransferAction). */
  transfer?: SerializedTransfer;
  /** User's preferred currency for new operations (falls back to DEFAULT_CURRENCY). */
  defaultCurrency?: string;
  onSuccess?: () => void;
}) {
  const isEdit = !!transfer;
  // The action is the create/edit union; both can now return `warning`
  // (create since R15.1 F5, edit since R15.2 D1) with the same shape.
  const [state, formAction, isPending] = useActionState<TransferFormState | null, FormData>(
    isEdit ? updateTransferAction : createTransferAction,
    null,
  );
  const t = useT("Transfers");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const locale = useLocale();
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // R15.1 Fase 5 — blocking confirm for negative balances. useActionState
  // returns [state, formAction, isPending] (no state setter), so "Cancel"
  // dismisses the CURRENT warning via local state; every new submission
  // resets it so a fresh warning can surface again. The form fields are
  // uncontrolled — their DOM values survive dismissal untouched.
  const [warningDismissed, setWarningDismissed] = useState(false);
  const warning = state?.warning ?? null;
  const showWarning = !!warning && !warningDismissed;

  // §13: explicit fallback via DEFAULT_CURRENCY — no silent hardcoded string.
  // When editing, the transfer's own currency wins; when creating, the first
  // account's currency is used; when no accounts exist, the user's defaultCurrency
  // or the named constant from currency.ts provides a traceable default.
  const [sourceCurrency, setSourceCurrency] = useState(
    transfer?.sourceCurrency ?? accounts[0]?.currency ?? defaultCurrency ?? DEFAULT_CURRENCY,
  );
  const [destCurrency, setDestCurrency] = useState(
    transfer?.destinationCurrency ?? accounts[0]?.currency ?? defaultCurrency ?? DEFAULT_CURRENCY,
  );
  const isCrossCurrency = sourceCurrency !== destCurrency;

  // Same-currency edits mirror source amount into destination so the pair
  // stays equal (TRA-2) without user input.
  const [mirroredDest, setMirroredDest] = useState(
    transfer && transfer.sourceCurrency === transfer.destinationCurrency
      ? String(transfer.sourceAmount.amount)
      : "",
  );

  // R15.1 Fase 4 — live derived-rate display: the form is uncontrolled
  // (defaultValue), so the two amounts are tracked in lightweight state and
  // the effective rate is recomputed on every change, read-only.
  const [sourceAmountStr, setSourceAmountStr] = useState(
    transfer ? String(transfer.sourceAmount.amount) : "",
  );
  const [destAmountStr, setDestAmountStr] = useState(
    transfer ? String(transfer.destinationAmount.amount) : "",
  );

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  const dismissWarning = () => {
    setWarningDismissed(true);
  };

  // R15.3.1 regression fix: use the NATIVE React 19 form action binding (same
  // as every other TwinCap form). The previous manual dispatch
  // (onSubmit + preventDefault + formAction(fd)) raced the App Router's action
  // pipeline under load: the router started a route transition (loading.tsx +
  // display:none on the old tree) and aborted the action request BEFORE it
  // transmitted (trace: POST created, send:-1), so the transfer was never
  // written and the dialog ended hidden inside the display:none ancestor
  // (toBeHidden passed spuriously). The native binding keeps the router in
  // action context — request is sent, response applied, revalidation runs
  // after commit.
  //
  // R15.3.1 confirm-flow fix: the warning modal lives INSIDE the same <form>
  // (no portal), and its "Register anyway" button is a real type="submit".
  // With the pure native binding, a second submission does NOT dispatch a new
  // action request (verified live: zero POSTs after clicking Register anyway;
  // the mutation only ever happened when the confirm step used an explicit
  // dispatch). The hybrid below keeps the native binding for the FIRST submit
  // (the fix above) and confirms the warning with an explicit dispatch: the
  // handler builds FormData from the CURRENT mounted form — the hidden
  // confirmNegativeBalance input included — and forwards it to the same action.
  // preventDefault stops the native submit from ALSO firing, avoiding any
  // double dispatch.
  const formRef = useRef<HTMLFormElement>(null);
  // The FIRST native submission's FormData, captured before the action runs.
  // React 19 automatically resets the form after a form action completes, so
  // by the time the R15.1 F5 confirm modal is shown the uncontrolled inputs
  // have been cleared (trace: the registration-anyway POST carried empty
  // sourceAccountId/destinationAccountId/sourceAmount/destinationAmount and
  // the server rejected it). Re-dispatching a freshly-built FormData would
  // re-send empty fields, so the confirm step re-uses this captured payload
  // and only flips the confirm flag — exactly the fields the first attempt
  // carried, including the idempotency key (the server released its claim
  // when it returned the warning, so the same key may retry).
  const firstSubmitDataRef = useRef<FormData | null>(null);

  // R15.1 Fase 5 — confirm the negative-balance warning. This runs from the
  // warning modal's "Register anyway" button (type="button"). It re-dispatches
  // the SAME server action with the SAME fields of the first attempt (captured
  // in handleSubmit before the action ran) plus the confirm flag, preserving
  // the router's action context and the per form-mount idempotency key.
  const handleConfirmNegativeBalance = () => {
    if (!firstSubmitDataRef.current) return;
    const fd = new FormData();
    for (const [key, value] of firstSubmitDataRef.current.entries()) {
      fd.append(key, value);
    }
    fd.set("confirmNegativeBalance", "true");
    formAction(fd);
  };

  // R15.1 F5: a fresh submission resets the warning dismissal (native submit).
  // The FormData snapshot is taken HERE, before the native action runs, so the
  // confirm step can re-send the exact same fields later.
  const handleSubmit = () => {
    if (formRef.current) {
      firstSubmitDataRef.current = new FormData(formRef.current);
    }
    setWarningDismissed(false); // a NEW submission may yield a NEW warning
  };

  // Derived rate shown read-only (R15.1 Fase 4 / R15.3 §11). Convention:
  // how many MAJOR units of the SOURCE currency one MAJOR unit of the
  // DESTINATION currency costs — (sourceAmount / 10^exp(src)) /
  // (destinationAmount / 10^exp(dst)). Both input fields hold the amounts in
  // minor units, so the exponents normalize them to majors here to match the
  // stored effectiveExchangeRate (COP→USD 190.000 → 50 shows 3.800). Only the
  // two real amounts are user input.
  const sourceAmt = Number(sourceAmountStr);
  const destAmt = Number(destAmountStr);
  const derivedRateDisplay =
    isCrossCurrency && sourceAmt > 0 && destAmt > 0
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
          sourceAmt / 10 ** exponentOf(sourceCurrency) / (destAmt / 10 ** exponentOf(destCurrency)),
        )
      : null;

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      {isEdit && <input type="hidden" name="transferId" value={transfer.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="sourceAccountId"
          name="sourceAccountId"
          label={t("fromAccount")}
          required
          disabled={isPending || isEdit}
          defaultValue={transfer?.sourceAccountId}
          placeholder={tCommon("select")}
          onChange={(e) => {
            const acc = accounts.find((a) => a.id === e.target.value);
            if (acc) setSourceCurrency(acc.currency);
          }}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />

        <Select
          id="destinationAccountId"
          name="destinationAccountId"
          label={t("toAccount")}
          required
          disabled={isPending || isEdit}
          defaultValue={transfer?.destinationAccountId}
          placeholder={tCommon("select")}
          onChange={(e) => {
            const acc = accounts.find((a) => a.id === e.target.value);
            if (acc) setDestCurrency(acc.currency);
          }}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="sourceAmount"
          name="sourceAmount"
          type="number"
          label={t("sourceAmount", { currency: sourceCurrency })}
          min="1"
          required
          disabled={isPending}
          defaultValue={transfer?.sourceAmount.amount}
          onChange={(e) => {
            setSourceAmountStr(e.target.value);
            if (isEdit && !isCrossCurrency) setMirroredDest(e.target.value);
          }}
        />
        <input type="hidden" name="sourceCurrency" value={sourceCurrency} />

        {isCrossCurrency && (
          <>
            <Input
              id="destinationAmount"
              name="destinationAmount"
              type="number"
              label={t("destAmount", { currency: destCurrency })}
              min="1"
              required
              disabled={isPending}
              defaultValue={transfer?.destinationAmount.amount}
              onChange={(e) => setDestAmountStr(e.target.value)}
            />
            <input type="hidden" name="destinationCurrency" value={destCurrency} />
          </>
        )}

        {/* Same-currency edits keep both legs equal; create derives dest from source */}
        {isEdit && !isCrossCurrency && (
          <input type="hidden" name="destinationAmount" value={mirroredDest} />
        )}
      </div>

      {/* R15.1 Fase 4 — TwinCap derives the exchange rate from both real
          amounts; the user never enters one. Read-only, live-recalculated. */}
      {derivedRateDisplay !== null && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("effectiveRate")}:{" "}
          {t("effectiveRateDescription", {
            destCurrency,
            rate: derivedRateDisplay,
            sourceCurrency,
          })}
        </p>
      )}

      <Input
        id="date"
        name="date"
        type="date"
        label={t("date")}
        required
        disabled={isPending}
        defaultValue={
          isEdit ? businessDateToInputValue(new Date(transfer.date)) : toDateInputValue()
        }
        max={toDateInputValue()}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t("note")}
        disabled={isPending}
        defaultValue={transfer?.note ?? ""}
      />

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={isPending}
          loading={isPending}
        >
          {isPending
            ? isEdit
              ? t("updating")
              : t("creating")
            : isEdit
              ? t("updateTransfer")
              : t("addTransfer")}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => onSuccess?.()}
          >
            {tCommon("cancel")}
          </Button>
        )}
      </div>

      {showWarning && warning && (
        <Modal
          open
          onClose={dismissWarning}
          title={t("insufficientFundsTitle")}
          actions={
            <>
              <Button
                type="button"
                variant="primary"
                disabled={isPending}
                loading={isPending}
                onClick={handleConfirmNegativeBalance}
              >
                {t("registerAnyway")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={dismissWarning}
              >
                {tCommon("cancel")}
              </Button>
            </>
          }
        >
          {/* The re-submission reuses every field of the mounted form; this
              hidden input is the ONLY extra field on the confirmed attempt. */}
          <input type="hidden" name="confirmNegativeBalance" value="true" />
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t("insufficientFundsDescription", {
              projected: formatAmount(warning.projectedBalance, warning.currency, locale),
            })}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">{t("warningCurrentBalance")}</dt>
              <dd className="font-medium text-zinc-900 dark:text-white">
                {formatAmount(warning.currentBalance, warning.currency, locale)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">{t("warningOperation")}</dt>
              <dd className="font-medium text-zinc-900 dark:text-white">
                −
                {formatAmount(
                  warning.currentBalance - warning.projectedBalance,
                  warning.currency,
                  locale,
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">{t("warningProjectedBalance")}</dt>
              <dd className="font-medium text-danger">
                {formatAmount(warning.projectedBalance, warning.currency, locale)}
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </form>
  );
}
