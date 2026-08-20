'use client';

import { useState } from 'react';
import { useT } from '../../../i18n/client';
import { CategoryForm } from './category-form';
import { Modal } from '../../../components/ui/modal';

export function CategoriesPageClient() {
  const [showForm, setShowForm] = useState(false);
  const t = useT('Categories');

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {t('addCategory')}
      </button>

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
