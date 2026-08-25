'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { editAbonoAction } from './actions';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';

export function EditAbonoForm({
  creditId,
  abonoId,
  amount,
  date,
  onCancel,
}: {
  creditId: string;
  abonoId: string;
  amount: number;
  date: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    editAbonoAction,
    null,
  );
  const t = useT('CreditsReceived');
  const tToast = useT('Toast');
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
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="abonoId" value={abonoId} />

      <p className="text-sm font-medium text-primary dark:text-primary">
        {t('editAbonoTitle')}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id={`edit-amount-${abonoId}`}
          name="amount"
          type="number"
          label={t('amount')}
          min="1"
          required
          defaultValue={amount}
          disabled={isPending}
        />

        <Input
          id={`edit-date-${abonoId}`}
          name="date"
          type="date"
          label={t('date')}
          required
          defaultValue={date}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t('updating') : tCommon('save')}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          disabled={isPending}
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
