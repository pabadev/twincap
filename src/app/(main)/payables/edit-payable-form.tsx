"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { editPayableAction } from "./actions";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";

export function EditPayableForm({
  payableId,
  total,
  currency,
  onCancel,
}: {
  payableId: string;
  total: number;
  currency: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(editPayableAction, null);
  const t = useT("Payables");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const tCommon = useT("Common");
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

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
      <input type="hidden" name="payableId" value={payableId} />
      {/* Currency lives on the payable's account; sent as-is to satisfy the
          use-case DTO — it is not independently editable. */}
      <input type="hidden" name="currency" value={currency} />

      <Input
        id={`edit-total-${payableId}`}
        name="total"
        hint={tCommon("moneyNoSeparators")}
        type="number"
        label={t("total", { currency })}
        min="1"
        required
        defaultValue={total}
        disabled={isPending}
      />

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
