'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../../i18n/client';
import { createCreditReceivedAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';

export function CreditForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(
    createCreditReceivedAction,
    null,
  );
  const t = useT('CreditsReceived');

  const [currency, setCurrency] = useState<Currency>(accounts[0]?.currency ?? DEFAULT_CURRENCY);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <Input
        id="counterparty"
        name="counterparty"
        type="text"
        label={t('counterparty')}
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="principal"
          name="principal"
          type="number"
          label={t('principal', { currency })}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="currency"
          name="currency"
          label={t('currency')}
          required
          disabled={isPending}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <Select
        id="accountId"
        name="accountId"
        label={t('accountId')}
        required
        disabled={isPending}
        options={accounts.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.currency})`,
        }))}
      />

      <Input
        id="date"
        name="date"
        type="date"
        label={t('date')}
        required
        disabled={isPending}
        defaultValue={new Date().toISOString().split('T')[0]}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="installments"
          name="installments"
          type="number"
          label={t('installments')}
          min="1"
          disabled={isPending}
        />

        <Select
          id="frequency"
          name="frequency"
          label={t('frequency')}
          disabled={isPending}
          placeholder="—"
          options={[
            { value: 'weekly', label: t('weekly') },
            { value: 'biweekly', label: t('biweekly') },
            { value: 'monthly', label: t('monthly') },
          ]}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('creating') : t('addCreditBtn')}
      </Button>
    </form>
  );
}
