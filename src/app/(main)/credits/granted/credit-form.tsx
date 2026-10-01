"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../../i18n/client";
import { createCreditGrantedAction } from "./actions";
import { IdempotencyField } from "../../../../components/ui/idempotency-field";
import type { SerializedAccount } from "../../../../core/domain/account";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";
import { toDateInputValue } from "../../../../lib/date";
import { formatAmount } from "../../../../lib/format";

export function CreditForm({
  accounts,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createCreditGrantedAction, null);
  const t = useT("CreditsGranted");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  // Founder norm (PROJECT-RULES §4): the selected account decides the
  // currency — no independent currency picker (the currency was previously a
  // manual select). Total preview falls back to an em dash until the user
  // picks an account.
  const [accountId, setAccountId] = useState("");
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currency = selectedAccount?.currency ?? "";
  const [installments, setInstallments] = useState<number>(0);
  const [installmentValue, setInstallmentValue] = useState<number>(0);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  // U1 error one-shot guard (`use-action-error.ts` note): `translateError`
  // identity is unstable after `router.refresh()` (messages re-import per RSC
  // request), so while the same error stays in `state` this effect could
  // re-fire and stack toasts. Memoize per error VALUE: a toast fires once
  // per distinct error; re-submitting and getting a DIFFERENT one still
  // shows. Same class as the sibling `successShownRef` guards.
  const lastErrorShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (state?.error && state.error !== lastErrorShownRef.current) {
      lastErrorShownRef.current = state.error;
      addToast(translateError(state.error), "error");
    }
  }, [state?.error, addToast, translateError]);

  const totalToPay =
    installments > 0 && installmentValue > 0 ? installmentValue * installments : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      {/* EXC-1 (founder 2026-09-30): the user classifies the credit as
          Personal or Business; derived abonos inherit the classification.
          Founder review (2026-09-30, pre-suite): contexto + fecha share one
          compact row instead of two full-width lines. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="context"
          name="context"
          label={tCommon("context")}
          disabled={isPending}
          placeholder={tCommon("select")}
          options={[
            { value: "Personal", label: tCommon("personal") },
            { value: "Business", label: tCommon("business") },
          ]}
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
      <Input
        id="counterparty"
        name="counterparty"
        type="text"
        label={t("debtor")}
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="principal"
          name="principal"
          hint={tCommon("moneyNoSeparators")}
          type="number"
          label={currency ? t("principal", { currency }) : t("principalPlain")}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="accountId"
          name="accountId"
          label={t("accountId")}
          required
          disabled={isPending}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder={tCommon("select")}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="installments"
          name="installments"
          type="number"
          label={t("installments")}
          min="1"
          disabled={isPending}
          value={installments || ""}
          onChange={(e) => setInstallments(Number(e.target.value) || 0)}
        />

        <Select
          id="frequency"
          name="frequency"
          label={t("frequency")}
          disabled={isPending}
          placeholder="—"
          options={[
            { value: "weekly", label: t("weekly") },
            { value: "biweekly", label: t("biweekly") },
            { value: "monthly", label: t("monthly") },
          ]}
        />
      </div>

      {installments > 0 && (
        <div className="space-y-1">
          <Input
            id="installmentValue"
            name="installmentValue"
            hint={tCommon("moneyNoSeparators")}
            type="number"
            label={t("installmentValueLabel")}
            min="1"
            required
            disabled={isPending}
            value={installmentValue || ""}
            onChange={(e) => setInstallmentValue(Number(e.target.value) || 0)}
          />
          {totalToPay !== undefined && currency && (
            <p className="text-xs text-surface-muted">
              {t("totalToPayLabel")}: {formatAmount(totalToPay, currency, locale)}
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t("creating") : t("addCreditBtn")}
      </Button>
    </form>
  );
}
