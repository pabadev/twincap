import type { SerializedAccount } from '../core/domain/account';
import type { SerializedCategory } from '../core/domain/category';
import type { MovementType } from '../core/domain/movement';

/**
 * Resolves the account preselection for the movement form from the active
 * table filter. 'all' (or an id that no longer exists) yields undefined so
 * the user picks an account manually.
 */
export function resolveDefaultAccountId(
  filterAccountId: string | undefined,
  accounts: ReadonlyArray<Pick<SerializedAccount, 'id'>>,
): string | undefined {
  if (!filterAccountId || filterAccountId === 'all') return undefined;
  return accounts.some((account) => account.id === filterAccountId)
    ? filterAccountId
    : undefined;
}

/** A movement's category must be of the same type (MOV-2). */
export function filterCategoriesByType(
  categories: ReadonlyArray<SerializedCategory>,
  type: MovementType,
): SerializedCategory[] {
  return categories.filter((category) => category.type === type);
}
