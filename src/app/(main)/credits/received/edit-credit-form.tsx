"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../../i18n/client";
import { editCreditReceivedAction } from "./actions";
import { MoneyInput } from "../../../../components/ui/money-input";
import { DEFAULT_CURRENCY } from "../../../../core/domain/currency";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";

export function EditCreditForm({
  creditId,
  principal,
  currency,
  installments,
  installmentValue,
  frequency,
  onCancel,
}: {
  creditId: string;
  principal: number;
  currency: string;
  /** DOM-1 (EXC-2): current plan terms — empty input = cleared (patch). */
  installments?: number;
  installmentValue?: number;
  frequency?: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(editCreditReceivedAction, null);
  const t = useT("CreditsReceived");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const tCommon = useT("Common");
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);
  // Terms as raw strings: counts stay plain numbers; the installment value is
  // a MoneyInput (server-side tolerant parse — never Number() here).
  const [installmentsStr, setInstallmentsStr] = useState(
    installments === undefined ? "" : String(installments),
  );
  const [installmentValueStr, setInstallmentValueStr] = useState(
    installmentValue === undefined ? "" : String(installmentValue),
  );

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      onCancel();
      router.refresh();
    }
  }, [state?.success, addToast, tToast, onCancel, router]);

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
      <input type="hidden" name="creditId" value={creditId} />
      {/* Currency lives on the credit's account; sent as-is to satisfy the
          use-case DTO — it is not independently editable. */}
      <input type="hidden" name="currency" value={currency} />

      <MoneyInput
        id={`edit-principal-${creditId}`}
        name="principal"
        currency={currency || DEFAULT_CURRENCY}
        min={1}
        label={t("principal", { currency })}
        required
        defaultValue={principal}
        disabled={isPending}
      />

      {/* DOM-1 (EXC-2): the installment plan is editable — informational
          fields only (they never touch movements or the economic result). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id={`edit-installments-${creditId}`}
          name="installments"
          type="number"
          label={t("installments")}
          min="0"
          value={installmentsStr}
          onChange={(e) => setInstallmentsStr(e.target.value)}
          disabled={isPending}
        />

        <MoneyInput
          id={`edit-installment-value-${creditId}`}
          name="installmentValue"
          label={t("installmentValueLabel")}
          currency={currency || DEFAULT_CURRENCY}
          min={0}
          value={installmentValueStr}
          onChange={(e) => setInstallmentValueStr(e.target.value)}
          disabled={isPending}
        />

        <Select
          id={`edit-frequency-${creditId}`}
          name="frequency"
          label={t("frequency")}
          disabled={isPending}
          placeholder="—"
          defaultValue={frequency ?? ""}
          options={[
            { value: "weekly", label: t("weekly") },
            { value: "biweekly", label: t("biweekly") },
            { value: "monthly", label: t("monthly") },
          ]}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
          {isPending ? t("updating") : tCommon("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
