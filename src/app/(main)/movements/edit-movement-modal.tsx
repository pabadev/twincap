'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { MOVEMENT_CONTEXTS } from '../../../core/domain/movement';
import type { MovementType, SerializedMovement } from '../../../core/domain/movement';
import { updateMovementAction } from './actions';
import type { SerializedCategory } from '../../../core/domain/category';
import type { SerializedAccount } from '../../../core/domain/account';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../lib/hooks/use-toast';
import { useActionError } from '../../../lib/use-action-error';
import { filterCategoriesByType } from '../../../lib/movement-form';
import { businessDateToInputValue, toDateInputValue } from '../../../lib/date';

export function EditMovementModal({
  movement,
  accounts,
  categories,
  onClose,
}: {
  movement: SerializedMovement;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateMovementAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<MovementType>(movement.type);
  const t = useT('Movements');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();
  const successShownRef = useRef(false);

  useEffect(() => {
    if (state?.success && !successShownRef.current) {
      successShownRef.current = true;
      addToast(tToast(state.success), 'success');
      router.refresh();
      onClose();
    }
  }, [state?.success, addToast, tToast, router, onClose]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), 'error');
    }
  }, [state?.error, addToast, translateError]);

  const filteredCategories = filterCategoriesByType(categories, selectedType);
  const account = accounts.find((a) => a.id === movement.accountId);

  return (
    <Modal open onClose={onClose} title={t('editMovement')}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} />
        <input type="hidden" name="movementId" value={movement.id} />

        <Select
          id="edit-account"
          name="accountId"
          label={t('account')}
          required
          disabled={isPending}
          defaultValue={movement.accountId}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
        />

        <Select
          id="edit-type"
          name="type"
          label={t('type')}
          required
          disabled
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as MovementType)}
          options={[
            { value: 'income', label: t('income') },
            { value: 'expense', label: t('expense') },
          ]}
        />

        <Select
          id="edit-categoryId"
          name="categoryId"
          label={t('category')}
          required
          disabled={isPending}
          defaultValue={movement.categoryId}
          options={filteredCategories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />

        <Input
          id="edit-date"
          name="date"
          type="date"
          label={t('date')}
          required
          disabled={isPending}
          defaultValue={businessDateToInputValue(new Date(movement.date))}
          max={toDateInputValue()}
        />

        <Input
          id="edit-amount"
          name="amount"
          type="number"
          label={`${tCommon('amount')} (${account?.currency ?? movement.amount.currency})`}
          min="1"
          required
          disabled={isPending}
          defaultValue={movement.amount.amount}
        />

        <Select
          id="edit-context"
          name="context"
          label={t('context')}
          disabled={isPending}
          defaultValue={movement.context ?? 'Personal'}
          options={MOVEMENT_CONTEXTS.map((c) => ({
            value: c,
            label: c === 'Personal' ? t('personal') : t('business'),
          }))}
        />

        <Input
          id="edit-note"
          name="note"
          type="text"
          label={t('note')}
          disabled={isPending}
          defaultValue={movement.note ?? ''}
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isPending}
            loading={isPending}
          >
            {isPending ? t('saving') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
