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
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
const { MongoOperationLogger } = vi.hoisted(() => ({
  MongoOperationLogger: vi.fn(),
}));
const { MongoUnitOfWork } = vi.hoisted(() => ({ MongoUnitOfWork: vi.fn() }));

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
vi.mock('../../../lib/track-analytics', () => ({ trackAnalytics }));
vi.mock('../../../infrastructure/repositories/operation-log-repository', () => ({
  MongoOperationLogger,
}));
vi.mock('../../../infrastructure/transactions/mongo-unit-of-work', () => ({
  MongoUnitOfWork,
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
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_ws: string, id: string) => {
        if (id === 'acc-1' || id === 'acc-2') {
          return { id, workspaceId: 'user-1', name: id, currency: 'COP', isFixed: false };
        }
        return null;
      }),
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
      aggregateBalance: vi.fn().mockResolvedValue(200000),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockImplementation(async (_ws: string, id: string) => {
        if (id === 'acc-1' || id === 'acc-2') {
          return { id, workspaceId: 'user-1', name: id, currency: 'COP', isFixed: false };
        }
        return null;
      }),
    }));
  });

  it('emits transferCreated scoped to the session user after a successful create', async () => {
    const fd = new FormData();
    fd.append('sourceAccountId', 'acc-1');
    fd.append('destinationAccountId', 'acc-2');
    fd.append('sourceAmount', '50000');
    fd.append('sourceCurrency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createTransferAction(null, fd);

    expect(result).toEqual({ success: 'transferCreated' });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith('transferCreated', 'user-1', 'user-1');
    expect(revalidatePath).toHaveBeenCalledWith('/transfers');
  });
});