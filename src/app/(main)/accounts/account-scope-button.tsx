'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../../i18n/client';
import { ACCOUNT_SCOPES, type AccountScope } from '../../../core/domain/account';
import { updateAccountScopeAction } from './actions';
import { ActionIconButton } from '../../../components/ui/action-icon-button';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Tag } from 'lucide-react';
import { useToast } from '../../../lib/hooks/use-toast';

/**
 * D3 remediation: reclassify an existing account's scope. Available for
 * every account (fixed included) — pure classification change.
 */
export function AccountScopeButton({
  accountId,
  scope,
}: {
  accountId: string;
  scope: AccountScope;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateAccountScopeAction,
    null,
  );
  const t = useT('Accounts');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    if (state?.success) {
      addToast(tToast(state.success), 'success');
      router.refresh();
      setOpen(false);
    }
    if (state?.error) {
      addToast(tToast(state.error), 'error');
    }
  }, [state?.success, state?.error, addToast, tToast, router]);

  return (
    <>
      <ActionIconButton
        icon={Tag}
        label={t('editScope')}
        onClick={() => setOpen(true)}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('editScope')}
        size="sm"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="accountId" value={accountId} />
          <Select
            id="account-scope"
            name="scope"
            label={t('scope')}
            required
            disabled={isPending}
            defaultValue={scope}
            options={ACCOUNT_SCOPES.map((s) => ({
              value: s,
              label: s === 'Personal' ? t('personal') : t('business'),
            }))}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
