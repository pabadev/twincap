import { describe, it, expect, vi } from 'vitest';
import { listAccountIdsByScope } from './list-account-ids-by-scope';
import { Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/repositories';

const DATE = new Date('2026-01-01T00:00:00Z');

function makeAccount(
  id: string,
  scope?: 'Personal' | 'Business',
): Account {
  return new Account({
    id,
    userId: 'user-1',
    name: `Account ${id}`,
    currency: 'COP',
    isFixed: false,
    scope,
    createdAt: DATE,
  });
}

describe('listAccountIdsByScope', () => {
  it('groups account ids by scope for the current user', async () => {
    const accounts = [
      makeAccount('acc-p1'),
      makeAccount('acc-b1', 'Business'),
      makeAccount('acc-p2'),
      makeAccount('acc-b2', 'Business'),
    ];
    const accountRepo = {
      findByUserId: vi.fn().mockResolvedValue(accounts),
    } as unknown as AccountRepository;

    const result = await listAccountIdsByScope('user-1', accountRepo);

    expect(result).toEqual({
      personal: ['acc-p1', 'acc-p2'],
      business: ['acc-b1', 'acc-b2'],
    });
  });

  it('returns empty groups when the user has no accounts', async () => {
    const accountRepo = {
      findByUserId: vi.fn().mockResolvedValue([]),
    } as unknown as AccountRepository;

    expect(await listAccountIdsByScope('user-1', accountRepo)).toEqual({
      personal: [],
      business: [],
    });
  });

  it('treats every account without Business scope as personal', async () => {
    const accounts = [makeAccount('acc-a'), makeAccount('acc-b')];
    const accountRepo = {
      findByUserId: vi.fn().mockResolvedValue(accounts),
    } as unknown as AccountRepository;

    const result = await listAccountIdsByScope('user-1', accountRepo);

    expect(result.personal).toEqual(['acc-a', 'acc-b']);
    expect(result.business).toEqual([]);
  });
});
