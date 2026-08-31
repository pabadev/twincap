'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../../../components/ui/button';
import { useT } from '../../../../i18n/client';
import { useToast } from '../../../../lib/hooks/use-toast';
import { markAsPaidAction } from './actions';

/** Mark a credit as fully paid: abono for the exact remaining pending (R5-C). */
export function MarkAsPaidButton({ creditId }: { creditId: string }) {
  const [pending, setPending] = useState(false);
  // Fresh key per mount so rapid double-clicks on the same credit dedup server-side.
  const idempotencyKey = useRef(crypto.randomUUID());
  const t = useT('CreditsGranted');
  const tToast = useT('Toast');
  const { addToast } = useToast();
  const router = useRouter();

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setPending(true);
    try {
      const formData = new FormData();
      formData.append('creditId', creditId);
      formData.append('idempotencyKey', idempotencyKey.current);
      const result = await markAsPaidAction(null, formData);
      if (result?.success) {
        addToast(tToast(result.success), 'success');
        router.refresh();
      } else if (result?.error) {
        addToast(tToast(result.error), 'error');
      }
    } catch (error) {
      console.error('MarkAsPaidButton: action failed', error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="success"
      size="sm"
      disabled={pending}
      loading={pending}
      onClick={handleClick}
    >
      {t('markAsPaid')}
    </Button>
  );
}