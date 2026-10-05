"use client";

import {
  createContext,
  useCallback,
  useContext,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "../../../i18n/client";
import { setInitialBalanceAction, correctInitialBalanceAction } from "./actions";
import { IdempotencyField } from "../../../components/ui/idempotency-field";
import {
  MoneyActionConfirmation,
  type ConfirmationDetailRow,
} from "../../../components/ui/money-action-confirmation";
import { useMoneyActionConfirmation } from "../../../lib/use-money-action-confirmation";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../lib/hooks/use-toast";
import { useActionError } from "../../../lib/use-action-error";
import { DEFAULT_CURRENCY } from "../../../core/domain/currency";
import { formatAmount } from "../../../lib/format";

/**
 * List-level host for the "Set / Correct initial balance" dialogs.
 *
 * WHY THE LIFT (2026-10-05): the dialogs used to live in per-ROW button
 * components. A server action response in Next 16 ALSO re-renders the
 * current route's RSC tree — and because the refreshed workspace data
 * includes the account's NEW balance state, the winning commit replaces the
 * row's "Set Initial Balance" button (by "Correct opening balance"),
 * unmounting the row component that owned the modal AND the form state:
 *  - winner: survives only because the success effect closes the modal in
 *    the same commit the state lands;
 *  - loser (duplicate-opening contract, e2e/duplicate-opening.spec.ts §11):
 *    gets its `error.conflict` state and toast, but its open modal is torn
 *    down by the refreshed rows — the "dialog stays open for retry" promise
 *    was unkeepable at row level (probe forensics ×3).
 *
 * Hosting the dialogs HERE (outside the rows) keeps the fibers stable: row
 * swaps remount buttons only, and winner/loser semantics work as documented.
 * Triggers (`InitialBalanceButton` / `CorrectInitialBalanceButton`) lift the
 * intent up via context.
 *
 * The provider keys each dialog rendering with an OPEN NONCE — every single
 * open remounts the whole dialog component (fresh useActionState, fresh
 * one-shot toast guards, fresh mount-scoped idempotency key), matching the
 * per-intent semantics the per-row buttons had.
 */

interface BalanceDialogDetail {
  accountId: string;
  currency?: string;
  mode: "set" | "correct";
  /** Monotonic open counter — the remount key per open. */
  nonce: number;
}

const BalanceDialogsContext = createContext<{
  open: (detail: Omit<BalanceDialogDetail, "nonce">) => void;
}>({ open: () => {} });

/** Row-button hook: lifts the dialog intent to the list-level host. */
export function useBalanceDialog() {
  return useContext(BalanceDialogsContext);
}

export function BalanceDialogsProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<BalanceDialogDetail | null>(null);
  const nonceRef = useRef(0);
  const open = useCallback((next: Omit<BalanceDialogDetail, "nonce">) => {
    nonceRef.current += 1;
    setDetail({ ...next, nonce: nonceRef.current });
  }, []);
  const close = useCallback(() => setDetail(null), []);

  return (
    <BalanceDialogsContext.Provider value={{ open }}>
      {children}
      {/* Both dialog fibers live HERE — never inside a row that a refreshed
          RSC payload can replace. When closed the Modal unmounts its form. */}
      {detail?.mode === "set" && (
        <SetInitialBalanceDialog
          key={`set-${detail.accountId}-${detail.nonce}`}
          detail={detail}
          onDone={close}
        />
      )}
      {detail?.mode === "correct" && (
        <CorrectInitialBalanceDialog
          key={`correct-${detail.accountId}-${detail.nonce}`}
          detail={detail}
          onDone={close}
        />
      )}
    </BalanceDialogsContext.Provider>
  );
}

/** U1 one-shot success guard + per-error-value one-shot error guard. */
function useOneShotToasts({
  state,
  onSettled,
}: {
  state: { success?: string; error?: string } | null;
  onSettled: (kind: "success" | "error", key: string) => void;
}) {
  const successShownRef = useRef(false);
  const lastErrorShownRef = useRef<string | null>(null);
  const success = state?.success;
  const error = state?.error;

  useEffect(() => {
    if (success && !successShownRef.current) {
      successShownRef.current = true;
      onSettled("success", success);
    }
  }, [success, onSettled]);

  useEffect(() => {
    if (error && error !== lastErrorShownRef.current) {
      lastErrorShownRef.current = error;
      onSettled("error", error);
    }
  }, [error, onSettled]);
}

interface BalanceDialogProps {
  detail: BalanceDialogDetail;
  onDone: () => void;
}

/**
 * "Set Initial Balance" dialog (was InitialBalanceButton's modal). UX-6
 * informed confirmation + captured-FormData dispatch (2026-10-05 rework)
 * kept byte for byte; success/error shared with the correct dialog.
 */
function SetInitialBalanceDialog({ detail, onDone }: BalanceDialogProps) {
  const [state, formAction, isPending] = useActionState(setInitialBalanceAction, null);
  const t = useT("Accounts");
  const tToast = useT("Toast");
  const tConfirm = useT("MoneyConfirmation");
  const tCommon = useT("Common");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const currency = detail.currency;

  const formRef = useRef<HTMLFormElement>(null);
  const {
    isConfirmOpen,
    interceptSubmit,
    handleConfirm: dispatchConfirmedForm,
    handleCancel,
  } = useMoneyActionConfirmation(formRef, formAction, isPending);

  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);
  const [confirmAmount, setConfirmAmount] = useState(0);
  const [awaitingResult, setAwaitingResult] = useState(false);

  useOneShotToasts({
    state,
    onSettled: (kind, key) => {
      if (kind === "success") {
        onDone();
        addToast(tToast(key), "success");
        router.refresh();
      } else {
        // Reset so a retry submits through the confirmation dialog again
        // (UX-6: every submit confirms first).
        setAwaitingResult(false);
        addToast(translateError(key), "error");
      }
    },
  });

  const buildConfirmDetails = (): ConfirmationDetailRow[] => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const amount = Number(fd?.get("amount") ?? 0);
    setConfirmAmount(amount);
    return [
      {
        label: t("balanceToSet"),
        value: formatAmount(amount, currency ?? DEFAULT_CURRENCY, locale),
      },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  const handleConfirm = () => {
    if (isPending || awaitingResult) return;
    setAwaitingResult(true);
    dispatchConfirmedForm();
  };

  return (
    <Modal open onClose={onDone} title={t("setInitialBalance")}>
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <IdempotencyField />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("setInitialBalanceDescription")}
        </p>
        <Input
          id="amount"
          name="amount"
          hint={tCommon("moneyNoSeparators")}
          type="number"
          label={t("balanceToSet")}
          min="1"
          required
          disabled={isPending}
        />
        <input type="hidden" name="accountId" value={detail.accountId} />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t("saving") : t("setInitialBalance")}
        </Button>

        <MoneyActionConfirmation
          open={isConfirmOpen && !awaitingResult}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={tConfirm("setInitialBalanceTitle")}
          description={tConfirm("setInitialBalanceDescription", {
            amount: formatAmount(confirmAmount, currency ?? DEFAULT_CURRENCY, locale),
          })}
          confirmLabel={tConfirm("confirm")}
          cancelLabel={tCommon("cancel")}
          variant="normal"
          detailRows={confirmDetails}
          loading={isPending}
        />
      </form>
    </Modal>
  );
}

/**
 * "Correct opening balance" dialog (was CorrectInitialBalanceButton's modal).
 * Same machinery as the set dialog; the action and i18n keys differ.
 */
function CorrectInitialBalanceDialog({ detail, onDone }: BalanceDialogProps) {
  const [state, formAction, isPending] = useActionState(correctInitialBalanceAction, null);
  const t = useT("Accounts");
  const tToast = useT("Toast");
  const tConfirm = useT("MoneyConfirmation");
  const tCommon = useT("Common");
  const translateError = useActionError();
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const currency = detail.currency;

  const formRef = useRef<HTMLFormElement>(null);
  const {
    isConfirmOpen,
    interceptSubmit,
    handleConfirm: dispatchConfirmedForm,
    handleCancel,
  } = useMoneyActionConfirmation(formRef, formAction, isPending);

  const [confirmDetails, setConfirmDetails] = useState<ConfirmationDetailRow[]>([]);
  const [confirmAmount, setConfirmAmount] = useState(0);
  const [awaitingResult, setAwaitingResult] = useState(false);

  useOneShotToasts({
    state,
    onSettled: (kind, key) => {
      if (kind === "success") {
        onDone();
        addToast(tToast(key), "success");
        router.refresh();
      } else {
        setAwaitingResult(false);
        addToast(translateError(key), "error");
      }
    },
  });

  const buildConfirmDetails = (): ConfirmationDetailRow[] => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const amount = Number(fd?.get("newAmount") ?? 0);
    setConfirmAmount(amount);
    return [
      {
        label: t("newBalance"),
        value: formatAmount(amount, currency ?? DEFAULT_CURRENCY, locale),
      },
    ];
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    setConfirmDetails(buildConfirmDetails());
    interceptSubmit(e, true);
  };

  const handleConfirm = () => {
    if (isPending || awaitingResult) return;
    setAwaitingResult(true);
    dispatchConfirmedForm();
  };

  return (
    <Modal open onClose={onDone} title={t("correctInitialBalance")}>
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <IdempotencyField />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("correctInitialBalanceDescription")}
        </p>
        <Input
          id="newAmount"
          name="newAmount"
          hint={tCommon("moneyNoSeparators")}
          type="number"
          label={t("newBalance")}
          min="1"
          required
          disabled={isPending}
        />
        <input type="hidden" name="accountId" value={detail.accountId} />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t("saving") : t("correctInitialBalance")}
        </Button>

        <MoneyActionConfirmation
          open={isConfirmOpen && !awaitingResult}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={tConfirm("correctInitialBalanceTitle")}
          description={tConfirm("correctInitialBalanceDescription", {
            amount: formatAmount(confirmAmount, currency ?? DEFAULT_CURRENCY, locale),
          })}
          confirmLabel={tConfirm("confirm")}
          cancelLabel={tCommon("cancel")}
          variant="normal"
          detailRows={confirmDetails}
          loading={isPending}
        />
      </form>
    </Modal>
  );
}
