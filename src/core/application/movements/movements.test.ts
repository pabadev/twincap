import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMovement } from './create-movement';
import { updateMovement } from './update-movement';
import { deleteMovement } from './delete-movement';
import { listMovements } from './list-movements';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { MovementRepository, CategoryRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

function fakeMovementRepo(overrides: Partial<MovementRepository> = {}): MovementRepository & { created: Movement[]; updated: Movement[]; deleted: string[] } {
  const created: Movement[] = [];
  const updated: Movement[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (movement: Movement) => {
      created.push(movement);
      return movement;
    }),
    update: vi.fn().mockImplementation(async (movement: Movement) => {
      updated.push(movement);
      return movement;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository & { categories: Category[] } {
  const categories: Category[] = [];
  return {
    categories,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByNameAndType: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (cat: Category) => { categories.push(cat); return cat; }),
    update: vi.fn().mockImplementation(async (cat: Category) => cat),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

function makeCategory(overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}): Category {
  return new Category({
    id: 'cat-1',
    userId: 'user-1',
    name: 'Salary',
    type: 'income',
    createdAt: new Date(),
    ...overrides,
  });
}

function fakeAccountRepo(
  accounts: Account[] = [],
): AccountRepository {
  return {
    findById: vi.fn().mockImplementation(async (_userId: string, id: string) =>
      accounts.find((a) => a.id === id) ?? null,
    ),
    findByUserId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    countReferences: vi.fn().mockResolvedValue(0),
  };
}

function makeAccount(
  id: string,
  scope: 'Personal' | 'Business' = 'Personal',
): Account {
  return new Account({
    id,
    userId: 'user-1',
    name: `Account ${id}`,
    currency: 'COP',
    isFixed: false,
    scope,
    createdAt: new Date(),
  });
}

function makeMovement(overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {}): Movement {
  return new Movement({
    id: 'mov-1',
    userId: 'user-1',
    accountId: 'acc-1',
    category: makeCategory(),
    type: 'income',
    amount: new Money(100000, 'COP'),
    date: new Date(),
    context: 'Personal',
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe('createMovement', () => {
  it('creates a manual income movement', async () => {
    const category = makeCategory();
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const movement = await createMovement(
      'user-1',
      {
        accountId: 'acc-1',
        type: 'income',
        amount: 50000,
        currency: 'COP',
        date: new Date('2025-01-15'),
        note: 'Salary',
        categoryId: 'cat-1',
      },
      movementRepo,
      categoryRepo,
      ids,
      accountRepo,
    );

    expect(movement.amount.amount).toBe(50000);
    expect(movement.type).toBe('income');
    expect(movement.signedAmount).toBe(50000);
    expect(movement.categoryId).toBe('cat-1');
    expect(movement.context).toBe('Personal');
    expect(movementRepo.created).toHaveLength(1);
  });

  it('creates a manual expense movement', async () => {
    const category = makeCategory({ id: 'cat-2', name: 'Food', type: 'expense' });
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    const movement = await createMovement(
      'user-1',
      {
        accountId: 'acc-1',
        type: 'expense',
        amount: 25000,
        currency: 'COP',
        date: new Date(),
        categoryId: 'cat-2',
      },
      movementRepo,
      categoryRepo,
      ids,
      accountRepo,
    );

    expect(movement.amount.amount).toBe(25000);
    expect(movement.type).toBe('expense');
    expect(movement.signedAmount).toBe(-25000);
  });

  it('derives context from the account scope, ignoring any client-sent value (D3)', async () => {
    const category = makeCategory();
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-biz', 'Business')]);
    const ids = fakeIdGen();

    const movement = await createMovement(
      'user-1',
      {
        accountId: 'acc-biz',
        type: 'income',
        amount: 50000,
        currency: 'COP',
        date: new Date(),
        categoryId: 'cat-1',
      },
      movementRepo,
      categoryRepo,
      ids,
      accountRepo,
    );

    expect(movement.context).toBe('Business');
  });

  it('throws NotFoundError when the account does not exist (D3 tenant guard)', async () => {
    const category = makeCategory();
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const accountRepo = fakeAccountRepo([]);
    const ids = fakeIdGen();

    await expect(
      createMovement(
        'user-1',
        {
          accountId: 'acc-missing',
          type: 'income',
          amount: 50000,
          currency: 'COP',
          date: new Date(),
          categoryId: 'cat-1',
        },
        movementRepo,
        categoryRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when amount is 0', async () => {
    const category = makeCategory();
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createMovement(
        'user-1',
        {
          accountId: 'acc-1',
          type: 'income',
          amount: 0,
          currency: 'COP',
          date: new Date(),
          categoryId: 'cat-1',
        },
        movementRepo,
        categoryRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when category type does not match movement type (MOV-2)', async () => {
    const expenseCategory = makeCategory({ id: 'cat-exp', name: 'Food', type: 'expense' });
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(expenseCategory),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createMovement(
        'user-1',
        {
          accountId: 'acc-1',
          type: 'income', // income movement with expense category
          amount: 50000,
          currency: 'COP',
          date: new Date(),
          categoryId: 'cat-exp',
        },
        movementRepo,
        categoryRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when category not found', async () => {
    const movementRepo = fakeMovementRepo();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-1')]);
    const ids = fakeIdGen();

    await expect(
      createMovement(
        'user-1',
        {
          accountId: 'acc-1',
          type: 'income',
          amount: 50000,
          currency: 'COP',
          date: new Date(),
          categoryId: 'missing',
        },
        movementRepo,
        categoryRepo,
        ids,
        accountRepo,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

// ─── Update ────────────────────────────────────────────────────────

describe('updateMovement', () => {
  it('updates amount and recalculates signedAmount', async () => {
    const existing = makeMovement();
    const category = makeCategory();
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });

    const updated = await updateMovement(
      'user-1',
      { movementId: 'mov-1', amount: 75000 },
      movementRepo,
      categoryRepo,
    );

    expect(updated.amount.amount).toBe(75000);
    expect(updated.signedAmount).toBe(75000);
    expect(movementRepo.updated).toHaveLength(1);
  });

  it('updates note', async () => {
    const existing = makeMovement();
    const category = makeCategory();
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });

    const updated = await updateMovement(
      'user-1',
      { movementId: 'mov-1', note: 'Updated note' },
      movementRepo,
      categoryRepo,
    );

    expect(updated.note).toBe('Updated note');
  });

  it('throws NotFoundError when movement does not exist', async () => {
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const categoryRepo = fakeCategoryRepo();

    await expect(
      updateMovement(
        'user-1',
        { movementId: 'missing', amount: 50000 },
        movementRepo,
        categoryRepo,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for system-linked movements (MOV-5)', async () => {
    const existing = makeMovement({
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const categoryRepo = fakeCategoryRepo();

    await expect(
      updateMovement(
        'user-1',
        { movementId: 'mov-1', amount: 50000 },
        movementRepo,
        categoryRepo,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when new category type does not match (MOV-2)', async () => {
    const existing = makeMovement();
    const expenseCategory = makeCategory({ id: 'cat-exp', type: 'expense' });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(expenseCategory),
    });

    await expect(
      updateMovement(
        'user-1',
        { movementId: 'mov-1', categoryId: 'cat-exp' },
        movementRepo,
        categoryRepo,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

// ─── Delete ────────────────────────────────────────────────────────

describe('deleteMovement', () => {
  it('deletes a manual movement', async () => {
    const existing = makeMovement();
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    await deleteMovement('user-1', 'mov-1', movementRepo);

    expect(movementRepo.deleted).toContain('mov-1');
  });

  it('throws NotFoundError when movement does not exist', async () => {
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(null),
    });

    await expect(
      deleteMovement('user-1', 'missing', movementRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for system-linked movements (MOV-5)', async () => {
    const existing = makeMovement({
      link: { kind: 'opening', refId: 'acc-1', opId: 'op-1' },
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    await expect(
      deleteMovement('user-1', 'mov-1', movementRepo),
    ).rejects.toThrow(ValidationError);
  });
});

// ─── List ──────────────────────────────────────────────────────────

describe('listMovements', () => {
  it('returns movements for a specific account', async () => {
    const movements = [makeMovement({ id: 'm1' }), makeMovement({ id: 'm2' })];
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue(movements),
    });

    const result = await listMovements('user-1', 'acc-1', movementRepo);

    expect(result).toHaveLength(2);
    expect(movementRepo.findByAccountId).toHaveBeenCalledWith('user-1', 'acc-1');
  });

  it('returns empty array when account has no movements', async () => {
    const movementRepo = fakeMovementRepo({
      findByAccountId: vi.fn().mockResolvedValue([]),
    });

    const result = await listMovements('user-1', 'acc-1', movementRepo);

    expect(result).toHaveLength(0);
  });
});
