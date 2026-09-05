import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { createSaleAction } = await import('./actions');

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
});