import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repositories, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoPayableRepository } = vi.hoisted(() => ({
  MongoPayableRepository: vi.fn(),
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
const { claimIdempotency } = vi.hoisted(() => ({ claimIdempotency: vi.fn() }));
const { releaseIdempotency } = vi.hoisted(() => ({ releaseIdempotency: vi.fn() }));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/payable-repository', () => ({
  MongoPayableRepository,
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
vi.mock('../../../infrastructure/auth/idempotency', () => ({
  claimIdempotency,
  releaseIdempotency,
}));

const { createPayableAction } = await import('./actions');

describe('createPayableAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it('rejects unauthenticated callers before any data access', async () => {
    const fd = new FormData();
    fd.append('counterparty', 'Proveedor S.A.S.');
    fd.append('total', '100000');
    fd.append('initialPayment', '0');
    fd.append('currency', 'COP');
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createPayableAction(null, fd);

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoPayableRepository).not.toHaveBeenCalled();
    expect(MongoMovementRepository).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('emits payableCreated scoped to the session user after a successful create', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);
    MongoOperationLogger.mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
    }));
    MongoUnitOfWork.mockImplementation(() => ({
      withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: 'acc-1',
        workspaceId: 'user-1',
        name: 'Cash',
        currency: 'COP',
        isFixed: false,
      }),
      // R15.2: createPayable touches the account doc inside the tx.
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoPayableRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);

    const fd = new FormData();
    fd.append('counterparty', 'Proveedor S.A.S.');
    fd.append('total', '100000');
    fd.append('initialPayment', '0');
    fd.append('currency', 'COP');
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', 'key-payable-1');

    const result = await createPayableAction(null, fd);

    expect(result).toEqual({ success: 'payableCreated' });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith('payableCreated', 'user-1', 'user-1');
    expect(revalidatePath).toHaveBeenCalledTimes(4);
  });

  it('rejects a request without an idempotency key before any data access (R15.1 6a)', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });

    const fd = new FormData();
    fd.append('counterparty', 'Proveedor S.A.S.');
    fd.append('total', '100000');
    fd.append('initialPayment', '0');
    fd.append('currency', 'COP');
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createPayableAction(null, fd);

    expect(result).toEqual({ error: 'error.idempotencyKeyRequired' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(MongoPayableRepository).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});