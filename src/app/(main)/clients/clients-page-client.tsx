'use client';

import { useState } from 'react';
import { useT } from '../../../i18n/client';
import { ClientForm } from './client-form';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';

export function ClientsPageClient() {
  const [showForm, setShowForm] = useState(false);
  const t = useT('Clients');

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
        {t('newClient')}
      </Button>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('newClient')}
      >
        <ClientForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </>
  );
}
