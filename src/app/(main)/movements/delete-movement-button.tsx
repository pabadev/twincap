'use client';

import { deleteMovementAction } from './actions';

export function DeleteMovementButton({ movementId }: { movementId: string }) {
  return (
    <form
      action={deleteMovementAction}
      onSubmit={(e) => {
        if (!confirm('Delete this movement? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="movementId" value={movementId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>
    </form>
  );
}
