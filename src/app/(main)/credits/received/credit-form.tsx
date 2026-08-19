'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { createCreditReceivedAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';

export function CreditForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(
    createCreditReceivedAction,
    null,
  );
  const t = useT('CreditsReceived');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  const [currency, setCurrency] = useState<Currency>(accounts[0]?.currency ?? DEFAULT_CURRENCY);

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.push('/credits/received');
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        id="counterparty"
        name="counterparty"
        type="text"
        label={t('counterparty')}
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
