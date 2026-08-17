import { Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/repositories';
import { NotFoundError } from '../../domain/errors';

export interface UpdateAccountInput {
  accountId: string;
  name?: string;
}

export async function updateAccount(
  userId: string,
  input: UpdateAccountInput,
  accountRepo: AccountRepository,
): Promise<Account> {
  const existing = await accountRepo.findById(userId, input.accountId);
  if (!existing) throw new NotFoundError('Account not found');

  // ACC-2: currency immutable — only name can change
  const updated = new Account({
    ...existing,
    name: input.name?.trim() ?? existing.name,
  });
  await accountRepo.update(updated);
  return updated;
}
