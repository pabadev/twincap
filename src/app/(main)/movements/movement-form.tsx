"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../i18n/client";
import { MOVEMENT_TYPES, MOVEMENT_CONTEXTS } from "../../../core/domain/movement";
import type { MovementType } from "../../../core/domain/movement";
import { CURRENCIES } from "../../../core/domain/currency";
import { createMovementAction, listAccountBalancesAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import type { SerializedCategory } from "../../../core/domain/category";
import type { SerializedAccount } from "../../../core/domain/account";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { filterCategoriesByType, resolveDefaultAccountId } from "../../../lib/movement-form";
import { toDateInputValue } from "../../../lib/date";
import { formatAmount } from "../../../lib/format";
import { shouldShowF5, computeProjectedBalance } from "../../../lib/movement-f5";
import type { AccountBalancesMap } from "../../../lib/movement-f5";
import { useMoneyActionConfirmation } from "../../../lib/use-money-action-confirmation";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../components/ui/money-action-confirmation";

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4">{children}</div>
    </fieldset>
  );
}

export function MovementForm({
  accounts,
  categories,
  defaultAccountId,
  defaultType,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  /** Account preselected via the movements table filter, if any. */
  defaultAccountId?: string;
  /** Preset movement type (income | expense), e.g. from the quick-action FAB. */
  defaultType?: MovementType;
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createMovementAction, null);
  const [selectedType, setSelectedType] = useState<MovementType>(defaultType ?? "income");
  const t = useT("Movements");
  const tTransfers = useT("Transfers");
  const tConfirm = useT("MoneyConfirmation");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // F5 (UX-6): live account balances for the negative-balance expense preview.
  // Mirrors the movements-list lazy reference-data load (movements-list.tsx
  // accounts/categories pattern); FAIL-OPEN — on error `balances` stays `{}`,
  // `shouldShowF5` resolves false and the form keeps its native direct submit.
  // The form remounts on every dialog open, so balances are re-fetched fresh.
  const [balances, setBalances] = useState<AccountBalancesMap>({});
  useEffect(() => {
    listAccountBalancesAction()
      .then(setBalances)
      .catch(() => {});
  }, []);

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

  // UX-6 informed confirmation (binding, hybrid R15.3.1): the native
  // `action={formAction}` binding is preserved — the hook only captures the
  // first FormData and, when `confirm` is true, prevents the native submit
  // and opens the confirmation instead. Confirming re-dispatches the SAME
  // captured FormData (SAME idempotency key — never regenerated, D9); the
  // explicit dispatch happens ONLY from the dialog's confirm button.
  const formRef = useRef<HTMLFormElement>(null);
  const { isConfirmOpen, interceptSubmit, handleConfirm, handleCancel } =
    useMoneyActionConfirmation(formRef, formAction, isPending);
  /** Detail rows rendered by the F5 dialog, computed at submit time. */
  const [confirmRows, setConfirmRows] = useState<ConfirmationDetailRow[]>([]);

  const filteredCategories = filterCategoriesByType(categories, selectedType);

  // F5 (UX-6 G2): conditional informed confirmation. The gate is computed NOW
  // from the current DOM values; `shouldShowF5` returns true ONLY for an
  // expense whose projected balance would go negative with a known balance in
  // the SAME currency as the movement. Income, sufficient expenses and
  // cross-currency cases are fail-open → direct native submit, no modal.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const accountId = String(fd.get("accountId") ?? "");
    const amount = Number(fd.get("amount"));
    const currency = String(fd.get("currency") ?? "");
    // The type select is controlled by `selectedType`; its DOM value is the
    // source of truth the server action receives ('income' | 'expense').
    const movementType = String(fd.get("type") ?? selectedType);
    const account = balances[accountId];
    const gate = shouldShowF5({
      currentBalance: account?.balance,
      amount,
      currency,
      accountCurrency: account?.currency,
      isExpense: movementType === "expense",
    });
    if (gate && account && Number.isFinite(amount)) {
      // Rows computed NOW from the current DOM values (the same source the
      // captured FormData carries); the projected row is highlighted (D1).
      setConfirmRows([
        {
          label: tTransfers("warningCurrentBalance"),
          value: formatAmount(account.balance, account.currency, locale),
        },
        {
          label: tTransfers("warningOperation"),
          value: `−${formatAmount(amount, currency, locale)}`,
        },
        {
          label: tTransfers("warningProjectedBalance"),
          value: formatAmount(
            computeProjectedBalance(account.balance, amount) ?? account.balance - amount,
            account.currency,
            locale,
          ),
          highlight: true,
        },
      ]);
    }
    interceptSubmit(e, gate);
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-5">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <FieldGroup title={t("groupSelection")}>
        <Select
          id="account"
          name="accountId"
          label={t("account")}
          required
          disabled={isPending}
          defaultValue={resolveDefaultAccountId(defaultAccountId, accounts)}
          placeholder={t("selectAccount")}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />

        <Select
          id="type"
          name="type"
          label={t("type")}
          required
          disabled={isPending}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as MovementType)}
          options={MOVEMENT_TYPES.map((mt) => ({
            value: mt,
            label: mt === "income" ? t("income") : t("expense"),
          }))}
        />

        <Select
          id="categoryId"
          name="categoryId"
          label={t("category")}
          required
          disabled={isPending}
          options={filteredCategories.map((c) => ({
            value: c.id,
            label: c.name,
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
      </FieldGroup>

      <FieldGroup title={t("groupDetails")}>
        <Input
          id="amount"
          name="amount"
          type="number"
          label={t("amount")}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="currency"
          name="currency"
          label={t("currency")}
          required
          disabled={isPending}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />

        <Select
          id="context"
          name="context"
          label={t("context")}
          disabled={isPending}
          defaultValue="Personal"
          options={MOVEMENT_CONTEXTS.map((c) => ({
            value: c,
            label: c === "Personal" ? t("personal") : t("business"),
          }))}
        />

        <div className="sm:col-span-2">
          <Input id="note" name="note" type="text" label={t("note")} disabled={isPending} />
        </div>
      </FieldGroup>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t("creating") : t("addMovement")}
      </Button>

      {/* F5 (UX-6): informed confirmation for a projected-negative expense —
          purely informational (createMovementAction has no balance guard), so
          this NEVER blocks. Confirming re-dispatches the SAME captured
          FormData with the SAME idempotency key (D9 — generated once on mount
          by IdempotencyField, reused by the re-dispatch); cancelling closes
          the dialog, keeps the form populated and dispatches nothing. */}
      <MoneyActionConfirmation
        open={isConfirmOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={tConfirm("negativeBalanceTitle")}
        confirmLabel={tTransfers("registerAnyway")}
        cancelLabel={tCommon("cancel")}
        variant="f5-negative-balance"
        detailRows={confirmRows}
        negativeBalanceWarning={tConfirm("projectedNegativeWarning")}
        projectedNegative
        loading={isPending}
      />
    </form>
  );
}
