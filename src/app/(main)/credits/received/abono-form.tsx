'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../../../i18n/client';
import { addAbonoAction } from './actions';
import type { SerializedAccount } from '../../../../core/domain/account';
import { formatAmount } from '../../../../lib/format';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { toDateInputValue } from '../../../../lib/date';

export function AbonoForm({
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
  const [state, formAction, isPending] = useActionState(
    addAbonoAction,
    null,
  );
  const t = useT('CreditsReceived');
  const tToast = useT('Toast');
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      router.refresh();
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-surface-border bg-surface-bg p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="currency" value={currency} />

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('pending')} {formatAmount(pending, currency, locale)}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          id={`amount-${creditId}`}
          name="amount"
          type="number"
          label={t('amount')}
          min="1"
          max={pending}
          required
          disabled={isPending}
        />

        <Select
          id={`accountId-${creditId}`}
          name="accountId"
          label={t('account')}
          required
          disabled={isPending}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />

        <Input
          id={`date-${creditId}`}
          name="date"
          type="date"
          label={t('date')}
          required
          disabled={isPending}
          defaultValue={toDateInputValue()}
        />
      </div>

      <Button
        type="submit"
        variant="success"
        size="sm"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('adding') : t('addAbono')}
      </Button>
    </form>
  );
}
