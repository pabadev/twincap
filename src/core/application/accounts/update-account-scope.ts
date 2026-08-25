import { Account, isAccountScope } from '../../domain/account';
import type { AccountScope } from '../../domain/account';
import type { AccountRepository } from '../../domain/repositories';
import { NotFoundError, ValidationError } from '../../domain/errors';

export interface UpdateAccountScopeInput {
  accountId: string;
  scope: AccountScope;
}

/**
 * D3 remediation: reclassify an existing account's Personal/Business scope.
 *
 * Pure classification change — balances and movements are untouched because
 * scope filters resolve via the account map at render time (the account is
 * the single source of truth). No other field can change through this path.
 */
export async function updateAccountScope(
  userId: string,
  input: UpdateAccountScopeInput,
  accountRepo: AccountRepository,
): Promise<Account> {
  if (!isAccountScope(input.scope)) {
    throw new ValidationError(`Unknown account scope: ${String(input.scope)}`);
  }

  // Tenant guard: findById is scoped by userId, so a foreign or missing
  // account resolves to null for this caller.
  const existing = await accountRepo.findById(userId, input.accountId);
  if (!existing) throw new NotFoundError('Account not found');

  const updated = new Account({
    ...existing,
    scope: input.scope,
  });
  await accountRepo.update(updated);
  return updated;
}
