import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transfer } from '../../../core/domain/transfer';
import { Movement } from '../../../core/domain/movement';
import { Category } from '../../../core/domain/category';
import { Money } from '../../../core/domain/money';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repositories, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoTransferRepository } = vi.hoisted(() => ({
  MongoTransferRepository: vi.fn(),
}));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { MongoCreditReceivedRepository } = vi.hoisted(() => ({
  MongoCreditReceivedRepository: vi.fn(),
}));
const { MongoCreditGrantedRepository } = vi.hoisted(() => ({
  MongoCreditGrantedRepository: vi.fn(),
}));
const { MongoSaleRepository } = vi.hoisted(() => ({
  MongoSaleRepository: vi.fn(),
}));
const { MongoPayableRepository } = vi.hoisted(() => ({
  MongoPayableRepository: vi.fn(),
}));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
const { MongoOperationLogger } = vi.hoisted(() => ({
  MongoOperationLogger: vi.fn(),
}));
const { MongoUnitOfWork } = vi.hoisted(() => ({ MongoUnitOfWork: vi.fn() }));
const { claimIdempotency } = vi.hoisted(() => ({ claimIdempotency: vi.fn() }));
const { releaseIdempotency } = vi.hoisted(() => ({ releaseIdempotency: vi.fn() }));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/transfer-repository', () => ({
  MongoTransferRepository,
}));
vi.mock('../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));
vi.mock('../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));
vi.mock('../../../infrastructure/repositories/credit-received-repository', () => ({
  MongoCreditReceivedRepository,
}));
vi.mock('../../../infrastructure/repositories/credit-granted-repository', () => ({
  MongoCreditGrantedRepository,
}));
vi.mock('../../../infrastructure/repositories/sale-repository', () => ({
  MongoSaleRepository,
}));
vi.mock('../../../infrastructure/repositories/payable-repository', () => ({
  MongoPayableRepository,
}));
vi.mock('../../../lib/track-analytics', () => ({ trackAnalytics }));
vi.mock('../../../infrastructure/repositories/operation-log-repository', () => ({
  MongoOperationLogger,
}));
vi.mock('../../../infrastructure/transactions/mongo-unit-of-work', () => ({
  MongoUnitOfWork,
}));
vi.mock('../../../infrastructure/auth/idempotency', () => ({
  claimIdempotency,
  releaseIdempotency,
}));

const { updateTransferAction, createTransferAction } = await import('./actions');

function makeTransfer(): Transfer {
  return new Transfer({
    id: 'tr-1',
    workspaceId: 'user-1',
    sourceAccountId: 'acc-1',
    destinationAccountId: 'acc-2',
    sourceAmount: new Money(50000, 'COP'),
    destinationAmount: new Money(50000, 'COP'),
    sourceCurrency: 'COP',
    destinationCurrency: 'COP',
    date: new Date('2026-08-01'),
    note: 'Transferencia original',
    movementIds: { expenseId: 'mov-exp', incomeId: 'mov-inc' },
    createdAt: new Date(),
  });
}

function makeMovement(type: 'expense' | 'income'): Movement {
  return new Movement({
    id: type === 'expense' ? 'mov-exp' : 'mov-inc',
    workspaceId: 'user-1',
    accountId: type === 'expense' ? 'acc-1' : 'acc-2',
    category: new Category({
      id: 'cat-transfer',
      workspaceId: 'user-1',
      name: 'Transfer',
      type,
      createdAt: new Date(),
    }),
    type,
    amount: new Money(50000, 'COP'),
    date: new Date('2026-08-01'),
    note: 'Transferencia',
    createdAt: new Date(),
  });
}

/**
 * Source-account balance seed for createTransferAction: an unlinked (manual)
 * movement is always considered live, so the derived balance is exactly the
 * seeded amount (replaces the removed aggregateBalance mock).
 */
function seededBalanceMovement(amount: number) {
  return [
    {
      id: 'seed-balance',
      workspaceId: 'user-1',
      accountId: 'acc-1',
      type: 'income' as const,
      amount: { amount, currency: 'COP' },
      signedAmount: amount,
      date: new Date('2026-09-01'),
      note: 'seed',
      link: undefined,
      createdAt: new Date('2026-09-10'),
    },
  ];
}

function transferFormData(): FormData {
  const fd = new FormData();
  fd.append('transferId', 'tr-1');
  fd.append('sourceAmount', '75000');
  fd.append('destinationAmount', '75000');
  fd.append('date', '2026-08-01');
  fd.append('note', 'Transferencia actualizada');
  fd.append('tzOffset', '300');
  return fd;
}

describe('updateTransferAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoTransferRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(makeTransfer()),
      update: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_userId: string, id: string) => {
        if (id === 'mov-exp') return makeMovement('expense');
        if (id === 'mov-inc') return makeMovement('income');
        return null;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      // R15.2 D1: the funds check derives the source balance via the lite
      // read. 200_000 keeps the default edit (50.000→75.000) non-negative;
      // the warning test below stubs a tighter balance.
      findByAccountIdForBalance: vi.fn().mockResolvedValue(
        seededBalanceMovement(200000),
      ),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_ws: string, id: string) => {
        if (id === 'acc-1' || id === 'acc-2') {
          return { id, workspaceId: 'user-1', name: id, currency: 'COP', isFixed: false };
        }
        return null;
      }),
    }));
    // R15.2 D1: live-parent resolution never reaches these in the mocked flow
    // (the seeded movements are unlinked), but the action instantiates them.
    MongoCreditReceivedRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoSaleRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoPayableRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoUnitOfWork.mockImplementation(() => ({
      withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
    }));
  });

  it('updates the transfer via the use case and returns the success toast key', async () => {
    const result = await updateTransferAction(null, transferFormData());

    expect(result).toEqual({ success: 'transferUpdated' });
    expect(revalidatePath).toHaveBeenCalledWith('/transfers');
    expect(revalidatePath).toHaveBeenCalledWith('/accounts');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/movements');
  });

  it('returns the structured warning (nothing written, no revalidation) when the edit projects a negative balance (R15.2 D1)', async () => {
    // Balance 10_000 < delta 25_000 (50.000→75.000) → projected −15_000.
    MongoMovementRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_userId: string, id: string) => {
        if (id === 'mov-exp') return makeMovement('expense');
        if (id === 'mov-inc') return makeMovement('income');
        return null;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      findByAccountIdForBalance: vi.fn().mockResolvedValue(
        seededBalanceMovement(10000),
      ),
    }));

    const result = await updateTransferAction(null, transferFormData());

    expect(result).toEqual({
      warning: { type: 'insufficient_funds', currentBalance: 10000, projectedBalance: -15000, currency: 'COP' },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('registers the negative-balance edit when confirmNegativeBalance is true (R15.2 D1)', async () => {
    MongoMovementRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_userId: string, id: string) => {
        if (id === 'mov-exp') return makeMovement('expense');
        if (id === 'mov-inc') return makeMovement('income');
        return null;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      findByAccountIdForBalance: vi.fn().mockResolvedValue(
        seededBalanceMovement(10000),
      ),
    }));

    const fd = transferFormData();
    fd.append('confirmNegativeBalance', 'true');
    const result = await updateTransferAction(null, fd);

    expect(result).toEqual({ success: 'transferUpdated' });
    expect(revalidatePath).toHaveBeenCalledWith('/transfers');
  });

  it('maps a missing transfer to the notFound error key', async () => {
    MongoTransferRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));

    const result = await updateTransferAction(null, transferFormData());

    expect(result).toEqual({ error: 'error.notFound' });
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateTransferAction(null, transferFormData());

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoTransferRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('createTransferAction (analytics emission)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);
    MongoOperationLogger.mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
    }));
    MongoUnitOfWork.mockImplementation(() => ({
      withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
    }));
    MongoTransferRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
      // R15.2: source balance derived from movements via the lite read
      // findByAccountIdForBalance (aggregateBalance removed). Unlinked seed
      // movement → always live.
      findByAccountIdForBalance: vi.fn().mockResolvedValue(
        seededBalanceMovement(200000),
      ),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_ws: string, id: string) => {
        if (id === 'acc-1' || id === 'acc-2') {
          return { id, workspaceId: 'user-1', name: id, currency: 'COP', isFixed: false };
        }
        return null;
      }),
      // R15.2: createTransfer touches the DESTINATION account doc inside the
      // tx (the source is already CAS-protected via bumpVersion).
      touch: vi.fn().mockResolvedValue(true),
      bumpVersion: vi.fn().mockResolvedValue(true),
    }));
    // R15.2: live-parent resolution never reaches these in the mocked flow
    // (the seeded movements are unlinked), but the action instantiates them.
    MongoCreditReceivedRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoSaleRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    MongoPayableRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
  });

  it('emits transferCreated scoped to the session user after a successful create', async () => {
    const fd = new FormData();
    fd.append('sourceAccountId', 'acc-1');
    fd.append('destinationAccountId', 'acc-2');
    fd.append('sourceAmount', '50000');
    fd.append('sourceCurrency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', 'key-transfer-1');

    const result = await createTransferAction(null, fd);

    expect(result).toEqual({ success: 'transferCreated' });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith('transferCreated', 'user-1', 'user-1');
    expect(revalidatePath).toHaveBeenCalledWith('/transfers');
  });

  it('returns the structured warning (nothing written, no analytics) on insufficient funds (F5)', async () => {
    // Balance 10_000 < sourceAmount 50_000 → projected −40_000.
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
      findByAccountIdForBalance: vi.fn().mockResolvedValue(
        seededBalanceMovement(10000),
      ),
    }));

    const fd = new FormData();
    fd.append('sourceAccountId', 'acc-1');
    fd.append('destinationAccountId', 'acc-2');
    fd.append('sourceAmount', '50000');
    fd.append('sourceCurrency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', 'key-transfer-2');

    const result = await createTransferAction(null, fd);

    expect(result).toEqual({
      warning: {
        type: 'insufficient_funds',
        currentBalance: 10000,
        projectedBalance: -40000,
        currency: 'COP',
      },
    });
    // Warning = nothing was written: no analytics, no cache revalidation and
    // no transfer create on the repo instance the action instantiated.
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalledWith('/transfers');
    const transferRepoInstance = MongoTransferRepository.mock.results[0]?.value as {
      create?: ReturnType<typeof vi.fn>;
    };
    expect(transferRepoInstance.create).not.toHaveBeenCalled();
  });

  it('rejects a request without an idempotency key before any data access (R15.1 6a)', async () => {
    const fd = new FormData();
    fd.append('sourceAccountId', 'acc-1');
    fd.append('destinationAccountId', 'acc-2');
    fd.append('sourceAmount', '50000');
    fd.append('sourceCurrency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createTransferAction(null, fd);

    expect(result).toEqual({ error: 'error.idempotencyKeyRequired' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(MongoTransferRepository).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});