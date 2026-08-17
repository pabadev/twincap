'use client';

import { deleteTransferAction } from './actions';

export function DeleteTransferButton({ transferId }: { transferId: string }) {
  return (
    <form
      action={deleteTransferAction}
      onSubmit={(e) => {
        if (!confirm('Delete this transfer? This will also remove the linked movements.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="transferId" value={transferId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>
    </form>
  );
}
