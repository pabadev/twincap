'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../../../i18n/client';
import { createCreditGrantedAction } from './actions';
import type { SerializedAccount } from '../../../../core/domain/account';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../../../core/domain/currency';
import type { Currency } from '../../../../core/domain/currency';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../lib/hooks/use-toast';
import { toDateInputValue } from '../../../../lib/date';
import { formatAmount } from '../../../../lib/format';

export function CreditForm({ accounts, onSuccess }: { accounts: SerializedAccount[]; onSuccess?: () => void }) {
  const [state, formAction, isPending] = useActionState(
    createCreditGrantedAction,
    null,
  );
  const t = useT('CreditsGranted');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const locale = useLocale();
  const { addToast } = useToast();
  const router = useRouter();

  const [currency, setCurrency] = useState<Currency>(accounts[0]?.currency ?? DEFAULT_CURRENCY);
  const [installments, setInstallments] = useState<number>(0);
  const [installmentValue, setInstallmentValue] = useState<number>(0);

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  const totalToPay = installments > 0 && installmentValue > 0 ? installmentValue * installments : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      <Input
        id="counterparty"
        name="counterparty"
        type="text"
        label={t('debtor')}
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
        placeholder={tCommon('select')}
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
        defaultValue={toDateInputValue()}
        max={toDateInputValue()}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="installments"
          name="installments"
          type="number"
          label={t('installments')}
          min="1"
          disabled={isPending}
          value={installments || ''}
          onChange={(e) => setInstallments(Number(e.target.value) || 0)}
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

      {installments > 0 && (
        <div className="space-y-1">
          <Input
            id="installmentValue"
            name="installmentValue"
            type="number"
            label={t('installmentValueLabel')}
            min="1"
            required
            disabled={isPending}
            value={installmentValue || ''}
            onChange={(e) => setInstallmentValue(Number(e.target.value) || 0)}
          />
          {totalToPay !== undefined && (
            <p className="text-xs text-muted-foreground">
              {t('totalToPayLabel')}: {formatAmount(totalToPay, currency, locale)}
            </p>
          )}
        </div>
      )}

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
