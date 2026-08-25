'use client';

import { useState } from 'react';
import { useT } from '../../../i18n/client';
import { CategoryForm } from './category-form';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';

export function CategoriesPageClient() {
  const [showForm, setShowForm] = useState(false);
  const t = useT('Categories');

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
        {t('addCategory')}
      </Button>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('addCategory')}
      >
        <CategoryForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </>
  );
}
