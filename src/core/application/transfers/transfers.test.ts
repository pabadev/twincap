import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransfer } from './create-transfer';
import { updateTransfer } from './update-transfer';
import { deleteTransfer } from './delete-transfer';
import { Transfer } from '../../domain/transfer';
import { Movement } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Account } from '../../domain/account';
import { Money } from '../../domain/money';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { TransferRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { TransactionHandle } from '../../domain/transaction';
import type { Currency } from '../../domain/currency';
import type { IdGenerator, UnitOfWork } from '../ports';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

function fakeAccountRepo(
  accounts: Account[] = [],
): AccountRepository & { findById: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn().mockImplementation(async (_userId: string, id: string) =>
      accounts.find((a) => a.id === id) ?? null,
    ),
    findByWorkspaceId: vi.fn().mockResolvedValue(accounts),
    create: vi.fn().mockImplementation(async (account: Account) => account),
    update: vi.fn().mockImplementation(async (account: Account) => account),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(true),
    countReferences: vi.fn().mockResolvedValue(0),
    bumpVersion: vi.fn().mockResolvedValue(true),
  };
}

function makeAccount(
  id: string,
  currency: Currency = 'COP',
): Account {
  return new Account({
    id,
    workspaceId: 'user-1',
    name: `Account ${id}`,
    currency,
    isFixed: false,
    createdAt: new Date(),
  });
}

function fakeTransferRepo(
  overrides: Partial<TransferRepository> = {},
): TransferRepository & { created: Transfer[]; updated: Transfer[]; deleted: string[] } {
  const created: Transfer[] = [];
  const updated: Transfer[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByIdRaw: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (transfer: Transfer) => {
      created.push(transfer);
      return transfer;
    }),
    update: vi.fn().mockImplementation(async (transfer: Transfer) => {
      updated.push(transfer);
      return transfer;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    ...overrides,
  };
}

function fakeMovementRepo(
  overrides: Partial<MovementRepository> = {},
): MovementRepository & { created: Movement[]; updated: Movement[]; deleted: string[] } {
  const created: Movement[] = [];
  const updated: Movement[] = [];
  const deleted: string[] = [];
  return {
    created,
    updated,
    deleted,
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
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
    deleteByRefId: vi.fn().mockResolvedValue(0),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    findByWorkspaceIdAndDateRange: async () => [],
    findByWorkspaceIdForBalance: async () => [],
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

/** R14-B: transparent unit of work that just runs the callback (no real tx). */
function fakeUow(): UnitOfWork {
  return {
    withTransaction: <T>(fn: (tx: TransactionHandle) => Promise<T>) =>
      fn({} as TransactionHandle),
  };
}

function makeTransfer(
  overrides: Partial<ConstructorParameters<typeof Transfer>[0]> = {},
): Transfer {
  return new Transfer({
    id: 'tr-1',
    workspaceId: 'user-1',
    sourceAccountId: 'acc-src',
    destinationAccountId: 'acc-dst',
    sourceAmount: new Money(50000, 'COP'),
    destinationAmount: new Money(50000, 'COP'),
    sourceCurrency: 'COP',
    destinationCurrency: 'COP',
    date: new Date('2025-06-01'),
    note: 'Test transfer',
    movementIds: { expenseId: 'mov-exp', incomeId: 'mov-inc' },
    createdAt: new Date(),
    ...overrides,
  });
}

function makeMovement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  const type = overrides.type ?? 'expense';
  return new Movement({
    id: 'mov-1',
    workspaceId: 'user-1',
    accountId: 'acc-src',
    category: new Category({ id: 'cat-1', workspaceId: 'user-1', name: 'Transfer', type, createdAt: new Date() }),
    type,
    amount: new Money(50000, 'COP'),
    date: new Date('2025-06-01'),
    note: 'Transfer',
    context: 'Personal',
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe('createTransfer', () => {
  it('creates a same-currency transfer (TRA-2)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    const res = await createTransfer(
      'user-1',
      {
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dst',
        sourceAmount: 50000,
        sourceCurrency: 'COP',
        date: new Date('2025-06-01'),
        note: 'Salary transfer',
      },
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );
    const transfer = res.transfer!;

    expect(transfer.sourceAmount.amount).toBe(50000);
    expect(transfer.destinationAmount.amount).toBe(50000);
    expect(transfer.sourceCurrency).toBe('COP');
    expect(transfer.destinationCurrency).toBe('COP');
    // R15.1 Fase 4: the rate is derived, never received — same-currency → 1.
    expect(transfer.effectiveExchangeRate).toBe(1);
    expect(transferRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(2);

    // F5: the source account version was CAS-bumped as the LAST write,
    // after both movements (source version 0 → 1 in this fake).
    expect(accountRepo.bumpVersion).toHaveBeenCalledWith(
      'user-1',
      'acc-src',
      0,
      expect.anything(),
    );
    const bumpOrder = (accountRepo.bumpVersion as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
    const movementOrder = (movementRepo.create as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
    expect(Math.max(...movementOrder)).toBeLessThan(Math.min(...bumpOrder));

    // Expense movement
    const expense = movementRepo.created[0];
    expect(expense.type).toBe('expense');
    expect(expense.amount.amount).toBe(50000);
    expect(expense.signedAmount).toBe(-50000);
    expect(expense.accountId).toBe('acc-src');
    expect(expense.link?.kind).toBe('transfer');

    // Income movement
    const income = movementRepo.created[1];
    expect(income.type).toBe('income');
    expect(income.amount.amount).toBe(50000);
    expect(income.signedAmount).toBe(50000);
    expect(income.accountId).toBe('acc-dst');
    expect(income.link?.kind).toBe('transfer');
  });

  it('sets context to undefined (neutral) for both transfer legs', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    await createTransfer(
      'user-1',
      {
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dst',
        sourceAmount: 50000,
        sourceCurrency: 'COP',
        date: new Date('2025-06-01'),
      },
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(movementRepo.created[0].context).toBeUndefined();
    expect(movementRepo.created[1].context).toBeUndefined();
  });

  it('throws NotFoundError when the source account does not exist', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-other-user',
          destinationAccountId: 'acc-dst',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the destination account does not exist', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-src')]);
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-missing',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('derives effectiveExchangeRate from both amounts for cross-currency (TRA-3)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(200000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst', 'USD'),
    ]);
    const ids = fakeIdGen();

    const res = await createTransfer(
      'user-1',
      {
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dst',
        sourceAmount: 100000,
        sourceCurrency: 'COP',
        destinationAmount: 30,
        destinationCurrency: 'USD',
        date: new Date('2025-06-01'),
      },
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );
    const transfer = res.transfer!;

    expect(transfer.sourceAmount.amount).toBe(100000);
    expect(transfer.sourceAmount.currency).toBe('COP');
    expect(transfer.destinationAmount.amount).toBe(30);
    expect(transfer.destinationAmount.currency).toBe('USD');
    // R15.1 Fase 4: rate == destinationAmount / sourceAmount, never input.
    expect(transfer.effectiveExchangeRate).toBe(30 / 100000);

    const expense = movementRepo.created[0];
    expect(expense.amount.currency).toBe('COP');

    const income = movementRepo.created[1];
    expect(income.amount.currency).toBe('USD');
    expect(income.amount.amount).toBe(30);
  });

  it('throws ValidationError when source = destination (TRA-1)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo();
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-1',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('balance insuficiente sin confirmación → warning estructurado, nada registrado (F5)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(10000), // balance < sourceAmount
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    const result = await createTransfer(
      'user-1',
      {
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dst',
        sourceAmount: 50000,
        sourceCurrency: 'COP',
        date: new Date(),
      },
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    // Sin confirmación: NADA se escribe — solo el warning estructurado.
    expect(result.transfer).toBeNull();
    expect(result.warning).toEqual({
      type: 'insufficient_funds',
      currentBalance: 10000,
      projectedBalance: -40000, // 10_000 − 50_000
      currency: 'COP',
    });
    expect(transferRepo.create).not.toHaveBeenCalled();
    expect(transferRepo.created).toHaveLength(0);
    expect(movementRepo.created).toHaveLength(0);
    expect(accountRepo.bumpVersion).not.toHaveBeenCalled();
  });

  it('con confirmNegativeBalance=true → transfer registrado con saldo negativo (F5)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(10000), // balance < sourceAmount
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    const { transfer } = await createTransfer(
      'user-1',
      {
        sourceAccountId: 'acc-src',
        destinationAccountId: 'acc-dst',
        sourceAmount: 50000,
        sourceCurrency: 'COP',
        date: new Date('2025-06-01'),
        confirmNegativeBalance: true,
      },
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
      fakeUow(),
    );

    expect(transfer).toBeDefined();
    expect(transferRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(2);
    // Saldo derivado del libro: seed 10_000 − expense 50_000 == −40_000.
    // El saldo negativo es la realidad financiera declarada y se registra.
    const expense = movementRepo.created[0];
    expect(expense.type).toBe('expense');
    expect(expense.amount.amount).toBe(50000);
    expect(10000 - expense.amount.amount).toBe(-40000);
    expect(accountRepo.bumpVersion).toHaveBeenCalledWith('user-1', 'acc-src', 0, expect.anything());
  });

  it('throws ValidationError for cross-currency without destination amount', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst', 'USD'),
    ]);
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-dst',
          sourceAmount: 100000,
          sourceCurrency: 'COP',
          destinationCurrency: 'USD',
          // destinationAmount omitted — both real amounts are required
          // (the rate is derived from them).
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('rolls back the whole transfer when a later write fails (R14-B)', async () => {
    const transferRepo = fakeTransferRepo();
    // The expense write (1st movement) succeeds; the income write (2nd) throws.
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
      create: vi.fn()
        .mockImplementationOnce(async (movement: Movement) => {
          movementRepo.created.push(movement);
          return movement;
        })
        .mockImplementationOnce(async () => {
          throw new Error('boom later (income write fails)');
        }),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-dst',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          date: new Date('2025-06-01'),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow('boom later (income write fails)');

    // The failure happened on the SECOND movement (income): the expense
    // write ran first (pushed, call #1), the income write threw (call #2),
    // which stopped the write phase — nothing after ran. The real rollback
    // (nothing persisted) is proven by the integration test.
    expect(transferRepo.create).toHaveBeenCalledTimes(1);
    expect(movementRepo.create).toHaveBeenCalledTimes(2);
    expect(transferRepo.created).toHaveLength(1);
    expect(movementRepo.created).toHaveLength(1);
  });

  it('aborts with ConflictError(DEBT_MODIFIED_MSG) when the CAS bump fails (F5)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src'),
      makeAccount('acc-dst'),
    ]);
    // Simulate a concurrent mutation of the source account between the read
    // and the write phase: the bump cannot apply → the transfer must abort.
    (accountRepo.bumpVersion as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const ids = fakeIdGen();

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-dst',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          date: new Date('2025-06-01'),
        },
        transferRepo,
        movementRepo,
        ids,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow('Debt was modified by another operation');
  });
});

// ─── Update ────────────────────────────────────────────────────────

describe('updateTransfer', () => {
  it('updates transfer amounts and cascades to both movements', async () => {
    const existing = makeTransfer();
    const expenseMov = makeMovement({ id: 'mov-exp', type: 'expense' });
    const incomeMov = makeMovement({
      id: 'mov-inc',
      accountId: 'acc-dst',
      type: 'income',
    });

    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const movementRepo = fakeMovementRepo({
      findById: vi.fn().mockImplementation(async (_userId: string, id: string) => {
        if (id === 'mov-exp') return expenseMov;
        if (id === 'mov-inc') return incomeMov;
        return null;
      }),
    });
    const accountRepo = fakeAccountRepo([makeAccount('acc-src'), makeAccount('acc-dst')]);

    const updated = await updateTransfer(
      'user-1',
      'tr-1',
      { sourceAmount: 75000, destinationAmount: 75000 },
      transferRepo,
      movementRepo,
      accountRepo,
      fakeUow(),
    );

    expect(updated.sourceAmount.amount).toBe(75000);
    expect(updated.destinationAmount.amount).toBe(75000);
    // R15.1 Fase 4: same-currency edits recompute the derived rate → 1.
    expect(updated.effectiveExchangeRate).toBe(1);
    expect(transferRepo.updated).toHaveLength(1);
    expect(movementRepo.updated).toHaveLength(2);
  });

  it('rejects a cross-currency edit that omits destinationAmount (rate is derived from both amounts)', async () => {
    const existing = makeTransfer({
      sourceCurrency: 'USD',
      destinationCurrency: 'COP',
      sourceAmount: new Money(100_00, 'USD'),
      destinationAmount: new Money(400_000, 'COP'),
      effectiveExchangeRate: 40,
    });
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src', 'USD'),
      makeAccount('acc-dst'),
    ]);

    await expect(
      updateTransfer(
        'user-1',
        'tr-1',
        { sourceAmount: 200_00 },
        transferRepo,
        movementRepo,
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(transferRepo.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when transfer does not exist', async () => {
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      updateTransfer('user-1', 'missing', { sourceAmount: 50000 }, transferRepo, movementRepo, fakeAccountRepo(), fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the source account no longer exists (D3)', async () => {
    const existing = makeTransfer();
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([]); // source + dest both resolve to null

    await expect(
      updateTransfer('user-1', 'tr-1', {}, transferRepo, movementRepo, accountRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
    expect(transferRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Create: currency integrity (ACC-1) ──────────────────────────────

describe('createTransfer currency integrity', () => {
  it('rejects when source currency differs from source account (ACC-1)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src', 'COP'),
      makeAccount('acc-dst', 'COP'),
    ]);

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-dst',
          sourceAmount: 50000,
          sourceCurrency: 'USD', // declared USD on a COP account
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        fakeIdGen(),
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(transferRepo.created).toHaveLength(0);
  });

  it('rejects when destination currency differs from destination account (ACC-1)', async () => {
    const transferRepo = fakeTransferRepo();
    const movementRepo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(100000),
    });
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src', 'COP'),
      makeAccount('acc-dst', 'COP'), // COP account
    ]);

    await expect(
      createTransfer(
        'user-1',
        {
          sourceAccountId: 'acc-src',
          destinationAccountId: 'acc-dst',
          sourceAmount: 50000,
          sourceCurrency: 'COP',
          destinationCurrency: 'USD', // declared USD on a COP account
          date: new Date(),
        },
        transferRepo,
        movementRepo,
        fakeIdGen(),
        accountRepo,
        fakeUow(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(transferRepo.created).toHaveLength(0);
  });
});

// ─── Update: currency re-check (ACC-1 defense-in-depth) ─────────────

describe('updateTransfer currency re-check', () => {
  it('rejects when source account currency no longer matches stored currency', async () => {
    const existing = makeTransfer({ sourceCurrency: 'USD', destinationCurrency: 'USD',
      sourceAmount: new Money(50000, 'USD'), destinationAmount: new Money(50000, 'USD') });
    const transferRepo = fakeTransferRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const movementRepo = fakeMovementRepo();
    const accountRepo = fakeAccountRepo([
      makeAccount('acc-src', 'COP'), // changed to COP since transfer was created
      makeAccount('acc-dst', 'USD'),
    ]);

    await expect(
      updateTransfer('user-1', 'tr-1', {}, transferRepo, movementRepo, accountRepo, fakeUow()),
    ).rejects.toThrow(ValidationError);
    expect(transferRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Delete ────────────────────────────────────────────────────────

describe('deleteTransfer', () => {
  it('deletes both movements then the transfer', async () => {
    const existing = makeTransfer();
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const movementRepo = fakeMovementRepo();

    await deleteTransfer('user-1', 'tr-1', transferRepo, movementRepo, fakeUow());

    expect(movementRepo.deleted).toContain('mov-exp');
    expect(movementRepo.deleted).toContain('mov-inc');
    expect(transferRepo.deleted).toContain('tr-1');
    // Both movements deleted before transfer (movementRepo.delete called before transferRepo.delete)
    expect(movementRepo.delete).toHaveBeenCalledTimes(2);
    expect(transferRepo.delete).toHaveBeenCalledTimes(1);
    const moveCallOrder = (movementRepo.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
    const transferCallOrder = (transferRepo.delete as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
    expect(Math.max(...moveCallOrder)).toBeLessThan(Math.min(...transferCallOrder));
  });

  it('throws NotFoundError when transfer does not exist', async () => {
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteTransfer('user-1', 'missing', transferRepo, movementRepo, fakeUow()),
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes transfer even without movementIds', async () => {
    const existing = makeTransfer({ movementIds: undefined });
    const transferRepo = fakeTransferRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });
    const movementRepo = fakeMovementRepo();

    await deleteTransfer('user-1', 'tr-1', transferRepo, movementRepo, fakeUow());

    expect(movementRepo.deleted).toHaveLength(0);
    expect(transferRepo.deleted).toContain('tr-1');
  });
});
