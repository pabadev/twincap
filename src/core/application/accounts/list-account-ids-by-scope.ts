import type { AccountRepository } from '../../domain/repositories';

/**
 * Account ids grouped by Personal/Business scope (D3) — reusable query
 * foundation for scope-filtered dashboards and reports (F4 builds on this).
 *
 * Resolution happens VIA the account list: callers filter movements by these
 * account ids; stored Movement.context is never trusted for filtering
 * historical data.
 */
export interface AccountIdsByScope {
  personal: string[];
  business: string[];
}

export async function listAccountIdsByScope(
  userId: string,
  accountRepo: AccountRepository,
): Promise<AccountIdsByScope> {
  const accounts = await accountRepo.findByUserId(userId);
  const personal: string[] = [];
  const business: string[] = [];
  for (const account of accounts) {
    if (account.scope === 'Business') {
      business.push(account.id);
    } else {
      personal.push(account.id);
    }
  }
  return { personal, business };
}
