'use client';

import { useT } from '../../../i18n/client';
import { deleteMovementAction } from './actions';

export function DeleteMovementButton({ movementId }: { movementId: string }) {
  const t = useT('Movements');

  return (
    <form
      action={deleteMovementAction}
      onSubmit={(e) => {
        if (!confirm(t('confirmDelete'))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="movementId" value={movementId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        {t('delete')}
      </button>
    </form>
  );
}
