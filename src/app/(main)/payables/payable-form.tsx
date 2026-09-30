"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { createPayableAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import type { SerializedAccount } from "../../../core/domain/account";
import { CURRENCIES } from "../../../core/domain/currency";
import type { Currency } from "../../../core/domain/currency";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { toDateInputValue } from "../../../lib/date";

export function PayableForm({
  accounts,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  onSuccess?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createPayableAction, null);
  const t = useT("Payables");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const [currency, setCurrency] = useState<Currency | "">("");

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

  return (
    <form action={formAction} className="space-y-4">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <Input
        id="counterparty"
        name="counterparty"
        type="text"
        label={t("counterparty")}
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="total"
          name="total"
          hint={tCommon("moneyNoSeparators")}
          type="number"
          label={t("total", { currency })}
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
          value={currency}
          placeholder={tCommon("select")}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <Select
        id="accountId"
        name="accountId"
        label={t("accountId")}
        required
        disabled={isPending}
        placeholder={tCommon("select")}
        options={accounts.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.currency})`,
        }))}
      />

      <Input
        id="initialPayment"
        name="initialPayment"
        hint={tCommon("moneyNoSeparators")}
        type="number"
        label={t("initialPayment", { currency })}
        min="0"
        step="1"
        defaultValue={0}
        disabled={isPending}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <Input id="dueDate" name="dueDate" type="date" label={t("dueDate")} disabled={isPending} />
      </div>

      <Input id="note" name="note" type="text" label={t("note")} disabled={isPending} />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t("creating") : t("addPayableBtn")}
      </Button>
    </form>
  );
}
