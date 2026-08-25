'use client';

import { useState } from 'react';
import { useT } from '../../../i18n/client';
import { AccountForm } from './account-form';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';

export function AccountsPageClient() {
  const [showForm, setShowForm] = useState(false);
  const t = useT('Accounts');

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
        {t('addAccount')}
      </Button>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('addAccount')}
      >
        <AccountForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </>
  );
}
