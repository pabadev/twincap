'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { addSaleAbonoAction } from './actions';
import type { Account } from '../../../../core/domain/account';
import { DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';

interface AbonoFormProps {
  saleId: string;
  accounts: Account[];
  onDone?: () => void;
}

export function AbonoForm({ saleId, accounts, onDone }: AbonoFormProps) {
  const [state, formAction, isPending] = useActionState(addSaleAbonoAction, null);
  const t = useT('Sales');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  const currency: Currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      onDone?.();
    }
  }, [state?.success, addToast, tToast, router, onDone]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (isPending) {
          e.preventDefault();
          return;
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="currency" value={currency} />

      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {tToast(state.error)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Input
          id="amount"
          name="amount"
          type="number"
          label={`${t('amount')} (${currency})`}
          min="1"
          required
          disabled={isPending}
        />

        <Select
          id="accountId"
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
          id="date"
          name="date"
          type="date"
          label={t('date')}
          required
          disabled={isPending}
          defaultValue={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="ghost"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t('adding') : t('addPaymentBtn')}
        </Button>
        {onDone && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onDone}
          >
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
