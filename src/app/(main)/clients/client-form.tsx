"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { createClientAction, updateClientAction } from "./actions";
import type { SerializedClient } from "../../../core/domain/client";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";

/** Editable subset of a client — enough to prefill and submit the edit form. */
export interface ClientFormData {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
}

export function ClientForm({
  client,
  onSuccess,
}: {
  /** Present → edit mode (prefills fields and calls updateClientAction). */
  client?: ClientFormData;
  /** Called after a successful save with the created/updated client snapshot (when available). */
  onSuccess?: (client?: SerializedClient) => void;
}) {
  const isEdit = !!client;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateClientAction : createClientAction,
    null,
  );
  const t = useT("Clients");
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
      router.refresh();
      onSuccess?.(state.client);
    }
  }, [state?.success, state?.client, addToast, tToast, router, onSuccess]);

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
      {isEdit && <input type="hidden" name="clientId" value={client.id} />}

      <Input
        id="name"
        name="name"
        type="text"
        label={t("name")}
        required
        defaultValue={client?.name}
        disabled={isPending}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        label={t("phone")}
        required
        placeholder={t("phonePlaceholder")}
        autoComplete="tel"
        defaultValue={client?.phone}
        disabled={isPending}
      />
      <p className="-mt-3 text-xs text-zinc-600 dark:text-zinc-400">{t("phoneFormatHint")}</p>

      <Input
        id="email"
        name="email"
        type="email"
        label={t("email")}
        defaultValue={client?.email}
        disabled={isPending}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t("note")}
        defaultValue={client?.note}
        disabled={isPending}
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
              : t("adding")
            : isEdit
              ? t("updateClient")
              : t("newClient")}
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
    </form>
  );
}
