import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repositories, and next/cache.

const { MongoUnitOfWork } = vi.hoisted(() => ({ MongoUnitOfWork: vi.fn() }));
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));
const { MongoCategoryRepository } = vi.hoisted(() => ({
  MongoCategoryRepository: vi.fn(),
}));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
const { MongoOperationLogger } = vi.hoisted(() => ({
  MongoOperationLogger: vi.fn(),
}));
const { claimIdempotency } = vi.hoisted(() => ({ claimIdempotency: vi.fn() }));
const { releaseIdempotency } = vi.hoisted(() => ({ releaseIdempotency: vi.fn() }));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));
vi.mock('../../../infrastructure/repositories/category-repository', () => ({
  MongoCategoryRepository,
}));
vi.mock('../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));
vi.mock('../../../lib/track-analytics', () => ({ trackAnalytics }));
vi.mock('../../../infrastructure/repositories/operation-log-repository', () => ({
  MongoOperationLogger,
}));
vi.mock('../../../infrastructure/auth/idempotency', () => ({
  claimIdempotency,
  releaseIdempotency,
}));
vi.mock('../../../infrastructure/transactions/mongo-unit-of-work', () => ({
  MongoUnitOfWork,
}));

const { createMovementAction } = await import('./actions');

describe('createMovementAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it('rejects unauthenticated callers before any data access', async () => {
    const fd = new FormData();
    fd.append('accountId', 'acc-1');
    fd.append('type', 'expense');
    fd.append('amount', '5000');
    fd.append('currency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createMovementAction(null, fd);

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoMovementRepository).not.toHaveBeenCalled();
    expect(MongoCategoryRepository).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('createMovementAction (analytics emissions)', () => {
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
    MongoCategoryRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: 'cat-1',
        workspaceId: 'user-1',
        name: 'Food',
        type: 'expense',
      }),
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: 'acc-1',
        workspaceId: 'user-1',
        name: 'Cash',
        currency: 'COP',
        isFixed: false,
      }),
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
  });

  it('emits firstMovement AND movementCreated scoped to the session user after a successful create', async () => {
    const fd = new FormData();
    fd.append('accountId', 'acc-1');
    fd.append('type', 'expense');
    fd.append('amount', '5000');
    fd.append('currency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('categoryId', 'cat-1');
    fd.append('idempotencyKey', 'key-movement-1');

    const result = await createMovementAction(null, fd);

    expect(result).toEqual({ success: 'movementCreated' });
    // R13-H contract: the deduplicated first event AND the regular appended
    // event (activation volume) are both emitted with the session scope.
    expect(trackAnalytics).toHaveBeenCalledTimes(2);
    expect(trackAnalytics).toHaveBeenNthCalledWith(1, 'firstMovement', 'user-1', 'user-1');
    expect(trackAnalytics).toHaveBeenNthCalledWith(2, 'movementCreated', 'user-1', 'user-1');
    expect(revalidatePath).toHaveBeenCalledWith('/movements');
  });

  it('rejects a request without an idempotency key before any data access (R15.1 6a)', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });

    const fd = new FormData();
    fd.append('accountId', 'acc-1');
    fd.append('type', 'expense');
    fd.append('amount', '5000');
    fd.append('currency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');

    const result = await createMovementAction(null, fd);

    expect(result).toEqual({ error: 'error.idempotencyKeyRequired' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(MongoMovementRepository).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});