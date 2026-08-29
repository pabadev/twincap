'use client';

import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { setInitialBalanceAction } from './actions';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../lib/hooks/use-toast';

export function InitialBalanceButton({ accountId }: { accountId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState(
    setInitialBalanceAction,
    null,
  );
  const t = useT('Accounts');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      setShowForm(false);
    }
  }, [state?.success, addToast, tToast, router]);

  useEffect(() => {
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.error, addToast, tToast]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setShowForm(true)}
      >
        {t('setInitialBalance')}
      </Button>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('setInitialBalance')}
      >
        <form action={formAction} className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('setInitialBalanceDescription')}
          </p>
          <Input
            id="amount"
            name="amount"
            type="number"
            label={t('balanceToSet')}
            min="1"
            required
            disabled={isPending}
          />
          <input type="hidden" name="accountId" value={accountId} />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isPending}
            loading={isPending}
          >
            {isPending ? t('saving') : t('setInitialBalance')}
          </Button>
        </form>
      </Modal>
    </>
  );
}