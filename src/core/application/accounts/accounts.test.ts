import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccount } from './create-account';
import { updateAccount } from './update-account';
import { deleteAccount } from './delete-account';
import { listAccounts } from './list-accounts';
import { Account } from '../../domain/account';
import { Category } from '../../domain/category';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors';
import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

function fakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository & { created: Account[]; deleted: string[] } {
  const created: Account[] = [];
  const deleted: string[] = [];
  return {
    created,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (account: Account) => {
      created.push(account);
      return account;
    }),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    countReferences: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function fakeMovementRepo(overrides: Partial<MovementRepository> = {}): MovementRepository & { created: unknown[] } {
  const created: unknown[] = [];
  return {
    created,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (movement) => {
      created.push(movement);
      return movement;
    }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(0),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return {
    generate: () => `id-${++idCounter}`,
  };
}

function makeAccount(overrides: Partial<ConstructorParameters<typeof Account>[0]> = {}): Account {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'My Account',
    currency: 'COP',
    isFixed: false,
    createdAt: new Date(),
    ...overrides,
  });
}

function makeMovement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  return new Movement({
    id: 'mov-1',
    userId: 'user-1',
    accountId: 'acc-1',
    category: new Category({
      id: 'cat-1',
      userId: 'user-1',
      name: 'Initial',
      type: 'income',
      createdAt: new Date(),
    }),
    type: 'income',
    amount: new Money(50000, 'COP'),
    date: new Date(),
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe('createAccount', () => {
  it('creates an account with the given name and currency', async () => {
    const accountRepo = fakeAccountRepo();
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    const account = await createAccount(
      'user-1',
      { name: 'Ahorros', currency: 'COP', initialBalance: 0 },
      accountRepo,
      movementRepo,
      ids,
    );

    expect(account.name).toBe('Ahorros');
    expect(account.currency).toBe('COP');
    expect(account.isFixed).toBe(false);
    expect(accountRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(0);
  });

  it('creates an opening movement when initialBalance > 0', async () => {
    const accountRepo = fakeAccountRepo();
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    const account = await createAccount(
      'user-1',
      { name: 'Ahorros', currency: 'COP', initialBalance: 50000 },
      accountRepo,
      movementRepo,
      ids,
    );

    expect(accountRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(1);

    const movement = movementRepo.created[0] as { type: string; link: { kind: string; refId: string } };
    expect(movement.type).toBe('income');
    expect(movement.link.kind).toBe('opening');
    expect(movement.link.refId).toBe(account.id);
  });

  it('does not create a movement when initialBalance is 0', async () => {
    const accountRepo = fakeAccountRepo();
    const movementRepo = fakeMovementRepo();
    const ids = fakeIdGen();

    await createAccount(
      'user-1',
      { name: 'Ahorros', currency: 'COP', initialBalance: 0 },
      accountRepo,
      movementRepo,
      ids,
    );

    expect(movementRepo.created).toHaveLength(0);
  });

  it('compensates: deletes the just-created account when the opening movement fails (R8)', async () => {
    const accountRepo = fakeAccountRepo();
    const movementRepo = fakeMovementRepo({
      create: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const ids = fakeIdGen();

    await expect(
      createAccount(
        'user-1',
        { name: 'Ahorros', currency: 'COP', initialBalance: 50000 },
        accountRepo,
        movementRepo,
        ids,
      ),
    ).rejects.toThrow('db down');

    // Account was created, then rolled back (deleted) — no orphan leftovers.
    expect(accountRepo.created).toHaveLength(1);
    const createdAccount = accountRepo.created[0]!;
    expect(accountRepo.deleted).toEqual([createdAccount.id]);
  });
});

// ─── Update ────────────────────────────────────────────────────────

describe('updateAccount', () => {
  it('updates the account name', async () => {
    const existing = makeAccount();
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateAccount(
      'user-1',
      { accountId: 'acc-1', name: 'New Name' },
      accountRepo,
    );

    expect(updated.name).toBe('New Name');
    expect(accountRepo.created.length + accountRepo.deleted.length).toBe(0);
  });

  it('throws NotFoundError when account does not exist', async () => {
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(null),
    });

    await expect(
      updateAccount('user-1', { accountId: 'missing', name: 'X' }, accountRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Delete ────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  it('deletes a non-fixed account with no references', async () => {
    const account = makeAccount();
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
    });

    await deleteAccount('user-1', 'acc-1', accountRepo, fakeMovementRepo());

    expect(accountRepo.deleted).toContain('acc-1');
  });

  it('rejects deletion of fixed accounts', async () => {
    const fixed = makeAccount({ isFixed: true });
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(fixed),
    });

    await expect(
      deleteAccount('user-1', 'acc-1', accountRepo, fakeMovementRepo()),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects deletion when account has references', async () => {
    const account = makeAccount();
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
      countReferences: vi.fn().mockResolvedValue(3),
    });

    await expect(
      deleteAccount('user-1', 'acc-1', accountRepo, fakeMovementRepo()),
    ).rejects.toThrow(ConflictError);
  });

  it('deletes a non-fixed account and cascades its opening movements', async () => {
    const account = makeAccount();
    const opening = makeMovement({
      id: 'mov-opening',
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
    });
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue([opening]),
    });

    await deleteAccount('user-1', 'acc-1', accountRepo, movementRepo);

    expect(movementRepo.delete).toHaveBeenCalledWith('user-1', 'mov-opening');
    expect(accountRepo.deleted).toContain('acc-1');
  });

  it('cascades openings before deleting the account', async () => {
    const account = makeAccount();
    const opening = makeMovement({
      id: 'mov-opening',
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const order: string[] = [];
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
      delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
        order.push(`account:${id}`);
        accountRepo.deleted.push(id);
      }),
    });
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue([opening]),
      delete: vi.fn().mockImplementation(async () => {
        order.push('movement:mov-opening');
      }),
    });

    await deleteAccount('user-1', 'acc-1', accountRepo, movementRepo);

    expect(order).toEqual(['movement:mov-opening', 'account:acc-1']);
  });

  it('is tolerant when an opening no longer exists', async () => {
    const account = makeAccount();
    const opening = makeMovement({
      id: 'mov-opening',
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
    });
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue([opening]),
      delete: vi.fn().mockRejectedValue(new NotFoundError('Movement mov-opening not found')),
    });

    await deleteAccount('user-1', 'acc-1', accountRepo, movementRepo);

    expect(accountRepo.deleted).toContain('acc-1');
  });

  it('only deletes openings, not other movements', async () => {
    const account = makeAccount();
    const opening = makeMovement({
      id: 'mov-opening',
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const manual = makeMovement({ id: 'mov-manual' });
    const accountRepo = fakeAccountRepo({
      findById: vi.fn().mockResolvedValue(account),
    });
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue([opening, manual]),
    });

    await deleteAccount('user-1', 'acc-1', accountRepo, movementRepo);

    expect(movementRepo.delete).toHaveBeenCalledTimes(1);
    expect(movementRepo.delete).toHaveBeenCalledWith('user-1', 'mov-opening');
  });
});

// ─── List ──────────────────────────────────────────────────────────

describe('listAccounts', () => {
  it('returns all accounts for the user', async () => {
    const accounts = [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })];
    const accountRepo = fakeAccountRepo({
      findByUserId: vi.fn().mockResolvedValue(accounts),
    });

    const result = await listAccounts('user-1', accountRepo);

    expect(result).toHaveLength(2);
    expect(accountRepo.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
