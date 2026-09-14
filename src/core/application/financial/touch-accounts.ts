import type { AccountRepository } from '../../domain/repositories';
import type { TransactionHandle } from '../../domain/transaction';

/**
 * R15.3.2 Fase 4 — shared-document protection helper for edit/delete flows.
 *
 * Every financial operation that changes an account's derived balance must
 * touch that account INSIDE its transaction as a conflict point (R15.1-6e):
 *
 * - Balance-calculation readers (dashboard, AccountDetail) read the account
 *   doc; a concurrent edit/delete must conflict with them ON THE ACCOUNT DOC,
 *   never silently interleave on the movements collection.
 * - A concurrent `deleteAccount` is impossible for accounts with references
 *   (ACC-4 guard), so a `false` touch here is a harmless no-op — there is no
 *   orphan risk to defend. Callers that DO map `false` → NotFoundError keep
 *   their explicit boolean checks (create/update flows); the aggregate-edit
 *   and delete flows use this helper for best-effort protection.
 *
 * Mounted as the LAST write of the transaction (after the entity writes), so
 * on commit the account version always moves on top of the financial change.
 *
 * Deduplicates account ids (a transfer can touch the same account twice when
 * source === destination) and executes sequentially: the MongoDB driver
 * forbids concurrent ops on one ClientSession (error 251 → infinite
 * withTransaction retry), so parallel Promise.all touches are NOT allowed.
 */
export async function touchAccounts(
  accountRepo: AccountRepository,
  workspaceId: string,
  accountIds: readonly string[],
  tx?: TransactionHandle,
): Promise<void> {
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) return;
  for (const accountId of unique) {
    await accountRepo.touch(workspaceId, accountId, tx);
  }
}

/** Convenience for single-account flows (same semantics as `touchAccounts`). */
export async function touchAccount(
  accountRepo: AccountRepository,
  workspaceId: string,
  accountId: string,
  tx?: TransactionHandle,
): Promise<void> {
  await accountRepo.touch(workspaceId, accountId, tx);
}