'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { createTransferAction, updateTransferAction } from './actions';
import { IdempotencyField } from '../../../components/ui/idempotency-field';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedTransfer } from '../../../core/domain/transfer';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';
import { useActionError } from '../../../lib/use-action-error';
import { businessDateToInputValue, toDateInputValue } from '../../../lib/date';

export function TransferForm({
  accounts,
  transfer,
  onSuccess,
}: {
  accounts: SerializedAccount[];
  /** Present → edit mode (prefills fields and calls updateTransferAction). */
  transfer?: SerializedTransfer;
  onSuccess?: () => void;
}) {
  const isEdit = !!transfer;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateTransferAction : createTransferAction,
    null,
  );
  const t = useT('Transfers');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  const [sourceCurrency, setSourceCurrency] = useState(
    transfer?.sourceCurrency ?? accounts[0]?.currency ?? 'COP',
  );
  const [destCurrency, setDestCurrency] = useState(
    transfer?.destinationCurrency ?? accounts[0]?.currency ?? 'COP',
  );
  const isCrossCurrency = sourceCurrency !== destCurrency;

  // Same-currency edits mirror source amount into destination so the pair
  // stays equal (TRA-2) without user input.
  const [mirroredDest, setMirroredDest] = useState(
    transfer && transfer.sourceCurrency === transfer.destinationCurrency
      ? String(transfer.sourceAmount.amount)
      : '',
  );

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), 'error');
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form action={formAction} className="space-y-4">
      <IdempotencyField />
      <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
      {isEdit && <input type="hidden" name="transferId" value={transfer.id} />}
      <Select
        id="sourceAccountId"
        name="sourceAccountId"
        label={t('fromAccount')}
        required
        disabled={isPending || isEdit}
        defaultValue={transfer?.sourceAccountId}
        placeholder={tCommon('select')}
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
        disabled={isPending || isEdit}
        defaultValue={transfer?.destinationAccountId}
        placeholder={tCommon('select')}
        onChange={(e) => {
          const acc = accounts.find((a) => a.id === e.target.value);
          if (acc) setDestCurrency(acc.currency);
        }}
        options={accounts.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.currency})`,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="sourceAmount"
          name="sourceAmount"
          type="number"
          label={t('sourceAmount', { currency: sourceCurrency })}
          min="1"
          required
          disabled={isPending}
          defaultValue={transfer?.sourceAmount.amount}
          onChange={(e) => {
            if (isEdit && !isCrossCurrency) setMirroredDest(e.target.value);
          }}
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
              defaultValue={transfer?.destinationAmount.amount}
            />
            <input type="hidden" name="destinationCurrency" value={destCurrency} />
          </>
        )}

        {/* Same-currency edits keep both legs equal; create derives dest from source */}
        {isEdit && !isCrossCurrency && (
          <input type="hidden" name="destinationAmount" value={mirroredDest} />
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
          defaultValue={transfer?.rate}
        />
      )}

      <Input
        id="date"
        name="date"
        type="date"
        label={t('date')}
        required
        disabled={isPending}
        defaultValue={
          isEdit
            ? businessDateToInputValue(new Date(transfer.date))
            : toDateInputValue()
        }
        max={toDateInputValue()}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t('note')}
        disabled={isPending}
        defaultValue={transfer?.note ?? ''}
      />

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={isPending}
          loading={isPending}
        >
          {isPending
            ? isEdit
              ? t('updating')
              : t('creating')
            : isEdit
              ? t('updateTransfer')
              : t('addTransfer')}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => onSuccess?.()}
          >
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}