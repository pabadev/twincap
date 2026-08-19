'use client';

import { useActionState, useState } from 'react';
import { useT } from '../../../i18n/client';
import { createTransferAction } from './actions';
import type { Account } from '../../../core/domain/account';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, isPending] = useActionState(
    createTransferAction,
    null,
  );
  const t = useT('Transfers');

  const [sourceCurrency, setSourceCurrency] = useState(accounts[0]?.currency ?? 'COP');
  const [destCurrency, setDestCurrency] = useState(accounts[0]?.currency ?? 'COP');
  const isCrossCurrency = sourceCurrency !== destCurrency;

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}

      <Select
        id="sourceAccountId"
        name="sourceAccountId"
        label={t('fromAccount')}
        required
        disabled={isPending}
        onChange={(e) => {
          const acc = accounts.find((a) => a.id === e.target.value);
          if (acc) setSourceCurrency(acc.currency);
        }}
        options={accounts.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.currency})`,
        }))}
      />

      <Select
        id="destinationAccountId"
        name="destinationAccountId"
        label={t('toAccount')}
        required
        disabled={isPending}
        onChange={(e) => {
          const acc = accounts.find((a) => a.id === e.target.value);
          if (acc) setDestCurrency(acc.currency);
        }}
        options={accounts.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.currency})`,
        }))}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="sourceAmount"
          name="sourceAmount"
          type="number"
          label={t('sourceAmount', { currency: sourceCurrency })}
          min="1"
          required
          disabled={isPending}
        />
        <input type="hidden" name="sourceCurrency" value={sourceCurrency} />

        {isCrossCurrency && (
          <>
            <Input
              id="destinationAmount"
              name="destinationAmount"
              type="number"
              label={t('destAmount', { currency: destCurrency })}
              min="1"
              required
              disabled={isPending}
            />
            <input type="hidden" name="destinationCurrency" value={destCurrency} />
          </>
        )}
      </div>

      {isCrossCurrency && (
        <Input
          id="rate"
          name="rate"
          type="number"
          label={t('fxRate', { from: sourceCurrency, to: destCurrency })}
          step="0.01"
          min="0"
          required
          disabled={isPending}
        />
      )}

      <Input
        id="date"
        name="date"
        type="date"
        label={t('date')}
        required
        disabled={isPending}
        defaultValue={new Date().toISOString().split('T')[0]}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t('note')}
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        {isPending ? t('creating') : t('addTransfer')}
      </Button>
    </form>
  );
}
