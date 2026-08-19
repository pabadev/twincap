'use client';

import { useActionState } from 'react';
import { useT, useLocale } from '../../../../i18n/client';
import { addAbonoAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { formatAmount } from '../../../../lib/format';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';

export function AbonoForm({
  creditId,
  pending,
  currency,
  accounts,
}: {
  creditId: string;
  pending: number;
  currency: string;
  accounts: Account[];
}) {
  const [state, formAction, isPending] = useActionState(
    addAbonoAction,
    null,
  );
  const t = useT('CreditsReceived');
  const locale = useLocale();

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <input type="hidden" name="creditId" value={creditId} />
      <input type="hidden" name="currency" value={currency} />

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('pending')} {formatAmount(pending, currency, locale)} {currency}
      </p>

      {state?.error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
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
          defaultValue={new Date().toISOString().split('T')[0]}
        />
      </div>

      <Button
        type="submit"
        variant="ghost"
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('adding') : t('addAbono')}
      </Button>
    </form>
  );
}
