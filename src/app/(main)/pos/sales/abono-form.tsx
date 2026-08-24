'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../../i18n/client';
import { addSaleAbonoAction } from './actions';
import type { SerializedAccount } from '../../../../core/domain/account';
import { DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { toDateInputValue } from '../../../../lib/date';

interface AbonoFormProps {
  saleId: string;
  accounts: SerializedAccount[];
  onDone?: () => void;
}

export function AbonoForm({ saleId, accounts, onDone }: AbonoFormProps) {
  const [state, formAction, isPending] = useActionState(addSaleAbonoAction, null);
  const t = useT('Sales');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const currency: Currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
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
        <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {tToast(state.error)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          defaultValue={toDateInputValue()}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="success"
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
