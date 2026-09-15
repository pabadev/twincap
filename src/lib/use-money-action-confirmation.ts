import { useRef, useState, type FormEvent, type MutableRefObject, type RefObject } from "react";

export interface MoneyActionConfirmationHook {
  isConfirmOpen: boolean;
  capturedRef: MutableRefObject<FormData | null>;
  interceptSubmit: (e: FormEvent<HTMLFormElement>, confirm: boolean) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

/**
 * Shared mechanics for the UX-6 informed-confirmation hybrid (R15.3.1).
 *
 * Every form keeps its native `action={formAction}` binding; this hook only
 * intercepts the submit event to capture the first FormData and, when the
 * validation passes and the flow requires confirmation (`confirm === true`),
 * prevents the native dispatch and opens the confirmation dialog instead.
 * `handleConfirm` re-dispatches the SAME captured FormData to the SAME
 * formAction — the idempotency key travels inside it and is NEVER
 * regenerated. `handleCancel` closes the dialog and clears the capture; the
 * uncontrolled form stays populated and nothing is dispatched.
 *
 * Pure mechanics: no i18n, no DOM globals (design D7).
 */
export function useMoneyActionConfirmation(
  formRef: RefObject<HTMLFormElement | null>,
  formAction: (fd: FormData) => void,
  isPending: boolean,
): MoneyActionConfirmationHook {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const capturedRef = useRef<FormData | null>(null);

  const interceptSubmit = (e: FormEvent<HTMLFormElement>, confirm: boolean) => {
    if (isPending) {
      // Re-entrant submit while a dispatch is in flight: block it (same
      // guard the POS abono form already had, now shared).
      e.preventDefault();
      return;
    }
    const form = formRef.current;
    if (!form) return;
    capturedRef.current = new FormData(form);
    if (confirm) {
      // Only the confirmation path prevents the native submit — with
      // `confirm === false` the native `action={formAction}` proceeds.
      e.preventDefault();
      setIsConfirmOpen(true);
    }
  };

  const handleConfirm = () => {
    if (!capturedRef.current || isPending) return;
    setIsConfirmOpen(false);
    formAction(capturedRef.current);
  };

  const handleCancel = () => {
    setIsConfirmOpen(false);
    capturedRef.current = null;
  };

  return { isConfirmOpen, capturedRef, interceptSubmit, handleConfirm, handleCancel };
}
