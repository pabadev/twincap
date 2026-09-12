import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Payable } from '../../../core/domain/payable';
import { Money } from '../../../core/domain/money';

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

const { createPayableAction, addAbonoAction } = await import('./actions');

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

describe('addAbonoAction (R15.3.1 §21 post-commit idempotency)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
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
      // R15.2: addAbono touches the payment account doc inside the tx.
      touch: vi.fn().mockResolvedValue(true),
    }));
    // A payable with pending = total − initialPayment − Σ abonos > 0 so the
    // abono in the test does not exceed the pending guard.
    MongoPayableRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([
        new Payable({
          id: 'pay-1',
          workspaceId: 'user-1',
          counterparty: 'Proveedor S.A.S.',
          total: new Money(100000, 'COP'),
          initialPayment: 0,
          accountId: 'acc-1',
          date: new Date('2026-09-01'),
          createdAt: new Date(),
        }),
      ]),
      addAbono: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
    revalidatePath.mockResolvedValue(undefined);
  });

  function addAbonoFormData(key: string): FormData {
    const fd = new FormData();
    fd.append('payableId', 'pay-1');
    fd.append('amount', '50000');
    fd.append('currency', 'COP');
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', key);
    return fd;
  }

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and the abono is not re-added', async () => {
    claimIdempotency.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The abono commits, then the FIRST post-commit revalidatePath (inside
    // revalidateMovementData) THROWS SYNCHRONOUSLY — the P1.2 defect path.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const fd = addAbonoFormData('key-abono-post-commit');

    const first = await addAbonoAction(null, fd);
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();
    // P1.2: the key is NOT released after a committed mutation.
    expect(releaseIdempotency).not.toHaveBeenCalled();
    // The mutation ran exactly once on the repo the action instantiated.
    const payableRepoInstance = MongoPayableRepository.mock.results[0]?.value as {
      addAbono: ReturnType<typeof vi.fn>;
    };
    expect(payableRepoInstance.addAbono).toHaveBeenCalledTimes(1);

    // Retry with the SAME key → duplicate; the abono is NOT re-added.
    const retry = await addAbonoAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(releaseIdempotency).not.toHaveBeenCalled();
    expect(payableRepoInstance.addAbono).toHaveBeenCalledTimes(1);
  });
});