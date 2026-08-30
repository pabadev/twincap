'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../../components/ui/button';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useT } from '../../../../i18n/client';
import { useToast } from '../../../../lib/hooks/use-toast';
import { writeOffCreditAction } from './actions';

/** Write off an uncollectible granted credit: records the expense for the unrecovered principal (R9/F). */
export function WriteOffButton({
  creditId,
  counterparty,
}: {
  creditId: string;
  counterparty: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT('CreditsGranted');
  const tCommon = useT('Common');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  async function handleConfirm() {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('creditId', creditId);
      const result = await writeOffCreditAction(null, formData);
      if (result?.success) {
        addToast(tToast(result.success), 'success');
        router.refresh();
      } else if (result?.error) {
        addToast(tToast(result.error), 'error');
      }
    } catch (error) {
      console.error('WriteOffButton: action failed', error);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        {t('writeOff')}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={t('writeOff')}
        description={t('confirmWriteOff')}
        confirmLabel={t('writeOff')}
        cancelLabel={tCommon('cancel')}
        tone="danger"
        loading={busy}
      />
    </>
  );
}