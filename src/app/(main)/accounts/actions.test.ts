import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Account } from '../../../core/domain/account';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));

const { updateAccountScopeAction } = await import('./actions');

function makeAccount(overrides: Partial<ConstructorParameters<typeof Account>[0]> = {}): Account {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Caja Menor',
    currency: 'COP',
    isFixed: false,
    scope: 'Personal',
    createdAt: new Date('2026-01-15T12:00:00Z'),
    ...overrides,
  });
}

function formData(scope: string | null, accountId = 'acc-1'): FormData {
  const fd = new FormData();
  fd.append('accountId', accountId);
  if (scope !== null) fd.append('scope', scope);
  return fd;
}

describe('updateAccountScopeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(async (account: Account) => account),
    }));
  });

  it('updates ONLY the scope of an owned account and revalidates paths', async () => {
    const existing = makeAccount();
    const repoInstance = {
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(async (account: Account) => account),
    };
    MongoAccountRepository.mockImplementation(() => repoInstance);

    const result = await updateAccountScopeAction(null, formData('Business'));

    expect(result).toEqual({ success: 'accountUpdated' });
    expect(connectDb).toHaveBeenCalledTimes(1);
    expect(repoInstance.findById).toHaveBeenCalledWith('user-1', 'acc-1');
    expect(repoInstance.update).toHaveBeenCalledTimes(1);

    const persisted = repoInstance.update.mock.calls[0][0] as Account;
    expect(persisted.scope).toBe('Business');
    // Pure classification change: every other field untouched.
    expect(persisted.name).toBe('Caja Menor');
    expect(persisted.currency).toBe('COP');
    expect(persisted.isFixed).toBe(false);
    expect(persisted.createdAt).toEqual(existing.createdAt);

    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(['/accounts', '/dashboard', '/movements']);
  });

  it('rejects an invalid scope value server-side without touching storage', async () => {
    const repoInstance = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    MongoAccountRepository.mockImplementation(() => repoInstance);

    const result = await updateAccountScopeAction(null, formData('Hustling'));

    expect(result).toEqual({ error: 'error.validation' });
    expect(repoInstance.findById).not.toHaveBeenCalled();
    expect(repoInstance.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a cross-tenant (foreign) account to NotFoundError key', async () => {
    // findById is tenant-scoped: another user's account resolves to null.
    const repoInstance = {
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    MongoAccountRepository.mockImplementation(() => repoInstance);

    const result = await updateAccountScopeAction(null, formData('Business', 'acc-of-other-user'));

    expect(result).toEqual({ error: 'error.notFound' });
    expect(repoInstance.update).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateAccountScopeAction(null, formData('Business'));

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
