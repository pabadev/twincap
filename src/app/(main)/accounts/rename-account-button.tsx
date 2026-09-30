"use client";

import { useRef, useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { updateAccountAction } from "./actions";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ActionIconButton } from "../../../components/ui/action-icon-button";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { Pencil } from "lucide-react";

export function RenameAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(updateAccountAction, null);
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
      router.refresh();
      setShowForm(false);
    }
  }, [state?.success, addToast, tToast, router]);

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
    <>
      <ActionIconButton
        icon={Pencil}
        label={tCommon("edit")}
        tone="primary"
        onClick={() => setShowForm(true)}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("renameTitle")}>
        <form action={formAction} className="space-y-4">
          <Input
            id="name"
            name="name"
            type="text"
            label={t("accountName")}
            required
            defaultValue={accountName}
            disabled={isPending}
          />
          <input type="hidden" name="accountId" value={accountId} />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isPending}
              loading={isPending}
            >
              {isPending ? t("saving") : tCommon("save")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setShowForm(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
