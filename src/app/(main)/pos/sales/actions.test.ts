import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sale } from '../../../../core/domain/sale';
import { Money } from '../../../../core/domain/money';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repositories, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCatalogItemRepository } = vi.hoisted(() => ({
  MongoCatalogItemRepository: vi.fn(),
}));
const { MongoSaleRepository } = vi.hoisted(() => ({
  MongoSaleRepository: vi.fn(),
}));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));
const { MongoClientRepository } = vi.hoisted(() => ({
  MongoClientRepository: vi.fn(),
}));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { MongoCreditGrantedRepository } = vi.hoisted(() => ({
  MongoCreditGrantedRepository: vi.fn(),
}));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
const { MongoOperationLogger } = vi.hoisted(() => ({
  MongoOperationLogger: vi.fn(),
}));
const { MongoUnitOfWork } = vi.hoisted(() => ({ MongoUnitOfWork: vi.fn() }));
const { claimIdempotency } = vi.hoisted(() => ({ claimIdempotency: vi.fn() }));
const { releaseIdempotency } = vi.hoisted(() => ({ releaseIdempotency: vi.fn() }));

vi.mock('../../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../../infrastructure/repositories/catalog-repository', () => ({
  MongoCatalogItemRepository,
}));
vi.mock('../../../../infrastructure/repositories/sale-repository', () => ({
  MongoSaleRepository,
}));
vi.mock('../../../../infrastructure/repositories/movement-repository', () => ({
  MongoMovementRepository,
}));
vi.mock('../../../../infrastructure/repositories/client-repository', () => ({
  MongoClientRepository,
}));
vi.mock('../../../../infrastructure/repositories/account-repository', () => ({
  MongoAccountRepository,
}));
vi.mock('../../../../infrastructure/repositories/credit-granted-repository', () => ({
  MongoCreditGrantedRepository,
}));
vi.mock('../../../../lib/track-analytics', () => ({ trackAnalytics }));
vi.mock('../../../../infrastructure/repositories/operation-log-repository', () => ({
  MongoOperationLogger,
}));
vi.mock('../../../../infrastructure/transactions/mongo-unit-of-work', () => ({
  MongoUnitOfWork,
}));
vi.mock('../../../../infrastructure/auth/idempotency', () => ({
  claimIdempotency,
  releaseIdempotency,
}));

const { createSaleAction, addSaleAbonoAction } = await import('./actions');

describe('createSaleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it('rejects unauthenticated callers before any data access', async () => {
    const fd = new FormData();
    fd.append(
      'lineItems',
      JSON.stringify([{ itemId: 'it-1', quantity: 1, unitPrice: 15000 }]),
    );
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('paymentMode', 'cash');
    fd.append('currency', 'COP');

    const result = await createSaleAction(null, fd);

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoSaleRepository).not.toHaveBeenCalled();
    expect(MongoCatalogItemRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a request without an idempotency key before any data access (R15.1 6a)', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });

    const fd = new FormData();
    fd.append(
      'lineItems',
      JSON.stringify([{ itemId: 'it-1', quantity: 1, unitPrice: 15000 }]),
    );
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('paymentMode', 'cash');
    fd.append('currency', 'COP');

    const result = await createSaleAction(null, fd);

    expect(result).toEqual({ error: 'error.idempotencyKeyRequired' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoSaleRepository).not.toHaveBeenCalled();
    expect(MongoCatalogItemRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('addSaleAbonoAction (R15.3.1 §21 post-commit idempotency)', () => {
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
    // A legacy on-credit sale with pending > 0: the LEGACY fallback path
    // addSaleAbono registers the abono + its income movement.
    MongoSaleRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([
        new Sale({
          id: 'sale-1',
          workspaceId: 'user-1',
          items: [{ itemId: 'it-1', quantity: 1, unitPrice: new Money(15000, 'COP') }],
          date: new Date('2026-09-01'),
          paymentMode: 'on-credit',
          accountId: 'acc-1',
          createdAt: new Date(),
        }),
      ]),
      addAbono: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    MongoCatalogItemRepository.mockImplementation(() => ({}));
    MongoClientRepository.mockImplementation(() => ({}));
    MongoCreditGrantedRepository.mockImplementation(() => ({}));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
    revalidatePath.mockResolvedValue(undefined);
  });

  function addSaleAbonoFormData(key: string): FormData {
    const fd = new FormData();
    fd.append('saleId', 'sale-1');
    fd.append('amount', '5000');
    fd.append('currency', 'COP');
    fd.append('accountId', 'acc-1');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', key);
    return fd;
  }

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and the abono is not re-added', async () => {
    claimIdempotency.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The abono commits, then the FIRST post-commit revalidatePath THROWS
    // SYNCHRONOUSLY (deliberately un-awaited in the action, so a rejected
    // promise would float without reaching the catch — same contract as the
    // accounts §21 test).
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const fd = addSaleAbonoFormData('key-sale-abono-post-commit');

    const first = await addSaleAbonoAction(null, fd);
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();
    // P1.2: the key is NOT released after a committed mutation.
    expect(releaseIdempotency).not.toHaveBeenCalled();
    // The mutation ran exactly once on the repo the action instantiated.
    const saleRepoInstance = MongoSaleRepository.mock.results[0]?.value as {
      addAbono: ReturnType<typeof vi.fn>;
    };
    expect(saleRepoInstance.addAbono).toHaveBeenCalledTimes(1);

    // Retry with the SAME key → duplicate; the abono is NOT re-added.
    const retry = await addSaleAbonoAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(releaseIdempotency).not.toHaveBeenCalled();
    expect(saleRepoInstance.addAbono).toHaveBeenCalledTimes(1);
  });
});