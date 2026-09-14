"use client";

import { useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Select } from "../../../../components/ui/select";
import type { SerializedAccount } from "../../../../core/domain/account";
import { useT, useLocale } from "../../../../i18n/client";
import { useToast } from "../../../../lib/hooks/use-toast";
import { useActionError } from "../../../../lib/use-action-error";
import { formatAmount } from "../../../../lib/format";
import { markAsPaidAction } from "./actions";

/**
 * Mark a credit as fully paid (R5-C / H-06): abono for the exact remaining
 * pending. The payment account is MANDATORY — the user picks it in a
 * confirmation dialog (the server action re-validates it server-side).
 */
export function MarkAsPaidButton({
  creditId,
  pending,
  currency,
  accounts,
}: {
  creditId: string;
  pending: number;
  currency: string;
  accounts: SerializedAccount[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  // Fresh key per mount so rapid double-clicks on the same credit dedup server-side.
  const idempotencyKey = useRef(crypto.randomUUID());
  const t = useT("CreditsGranted");
  const tCommon = useT("Common");
  const tToast = useT("Toast");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();

  const accountOptions = accounts
    .filter((a) => a.currency === currency)
    .map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }));

  function openDialog(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setAccountId("");
    setAccountError(null);
    setOpen(true);
  }

  async function handleConfirm() {
    if (!accountId) {
      setAccountError(t("accountRequired"));
      return;
    }
    setBusy(true);
    setAccountError(null);
    try {
      const formData = new FormData();
      formData.append("creditId", creditId);
      formData.append("accountId", accountId);
      formData.append("idempotencyKey", idempotencyKey.current);
      const result = await markAsPaidAction(null, formData);
      if (result?.success) {
        addToast(tToast(result.success), "success");
        router.refresh();
        setOpen(false);
        setAccountId("");
      } else if (result?.error === "accountRequired") {
        // Server-side authoritative guard — mirror it as an inline field error.
        idempotencyKey.current = crypto.randomUUID();
        setAccountError(t("accountRequired"));
      } else if (result?.error) {
        idempotencyKey.current = crypto.randomUUID();
        addToast(translateError(result.error), "error");
      }
    } catch (error) {
      console.error("MarkAsPaidButton: action failed", error);
      idempotencyKey.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="success" size="sm" onClick={openDialog}>
        {t("markAsPaid")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={t("markAsPaid")}
        description={t("confirmMarkAsPaid", { amount: formatAmount(pending, currency, locale) })}
        confirmLabel={t("markAsPaid")}
        cancelLabel={tCommon("cancel")}
        tone="primary"
        loading={busy}
      >
        <Select
          id="paymentAccountId"
          label={t("account")}
          required
          placeholder={t("selectPaymentAccount")}
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setAccountError(null);
          }}
          error={accountError ?? undefined}
          options={accountOptions}
        />
      </ConfirmDialog>
    </>
  );
}
