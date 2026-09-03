import type { Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/repositories';

export async function listAccounts(
  workspaceId: string,
  accountRepo: AccountRepository,
): Promise<Account[]> {
  return accountRepo.findByWorkspaceId(workspaceId);
}
