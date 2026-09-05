'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { editCreditGrantedAction } from './actions';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { useActionError } from '../../../../lib/use-action-error';

export function EditCreditForm({
  creditId,
  principal,
  currency,
  onCancel,
}: {
  creditId: string;
  principal: number;
  currency: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    editCreditGrantedAction,
    null,
  );
  const t = useT('CreditsGranted');
  const tToast = useT('Toast');
  const translateError = useActionError();
  const tCommon = useT('Common');
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      onCancel();
      router.refresh();
    }
  }, [state?.success, addToast, tToast, onCancel, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), 'error');
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="creditId" value={creditId} />
      {/* Currency lives on the credit's account; sent as-is to satisfy the
          use-case DTO — it is not independently editable. */}
      <input type="hidden" name="currency" value={currency} />

      <Input
        id={`edit-principal-${creditId}`}
        name="principal"
        type="number"
        label={t('principal', { currency })}
        min="1"
        required
        defaultValue={principal}
        disabled={isPending}
      />

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t('updating') : tCommon('save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
        >
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  );
}
