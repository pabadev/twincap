"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { CURRENCIES } from "../../../core/domain/currency";
import { createAccountAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";

export function AccountForm({ onDone }: { onDone?: () => void }) {
  const [state, formAction, isPending] = useActionState(createAccountAction, null);
  const t = useT("Accounts");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), "success");
      // Consumer first, refresh last: a refresh may suspend + remount the tree
      // (loading.tsx) and destroy queued client state changes.
      onDone?.();
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

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
      <Input
        id="name"
        name="name"
        type="text"
        label={t("accountName")}
        required
        disabled={isPending}
      />

      <Select
        id="currency"
        name="currency"
        label={t("currency")}
        required
        disabled={isPending}
        placeholder={tCommon("select")}
        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
      />

      <Input
        id="initialBalance"
        name="initialBalance"
        hint={tCommon("moneyNoSeparators")}
        type="number"
        label={t("initialBalance")}
        min="0"
        defaultValue="0"
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t("creating") : t("createAccount")}
      </Button>
    </form>
  );
}
