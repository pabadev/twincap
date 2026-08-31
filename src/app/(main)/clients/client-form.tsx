'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { createClientAction, updateClientAction } from './actions';
import type { SerializedClient } from '../../../core/domain/client';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';
import { useActionError } from '../../../lib/use-action-error';

/** Editable subset of a client — enough to prefill and submit the edit form. */
export interface ClientFormData {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
}

export function ClientForm({
  client,
  onSuccess,
}: {
  /** Present → edit mode (prefills fields and calls updateClientAction). */
  client?: ClientFormData;
  /** Called after a successful save with the created/updated client snapshot (when available). */
  onSuccess?: (client?: SerializedClient) => void;
}) {
  const isEdit = !!client;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateClientAction : createClientAction,
    null,
  );
  const t = useT('Clients');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const translateError = useActionError();
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      onSuccess?.(state.client);
    }
  }, [state?.success, addToast, tToast, router, onSuccess]);

  useEffect(() => {
    if (state?.error) {
      addToast(translateError(state.error), 'error');
    }
  }, [state?.error, addToast, translateError]);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="clientId" value={client.id} />}

      <Input
        id="name"
        name="name"
        type="text"
        label={t('name')}
        required
        defaultValue={client?.name}
        disabled={isPending}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        label={t('phone')}
        defaultValue={client?.phone}
        disabled={isPending}
      />

      <Input
        id="email"
        name="email"
        type="email"
        label={t('email')}
        defaultValue={client?.email}
        disabled={isPending}
      />

      <Input
        id="note"
        name="note"
        type="text"
        label={t('note')}
        defaultValue={client?.note}
        disabled={isPending}
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
              : t('adding')
            : isEdit
              ? t('updateClient')
              : t('newClient')}
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