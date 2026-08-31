import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCatalogItemRepository } = vi.hoisted(() => ({
  MongoCatalogItemRepository: vi.fn(),
}));

vi.mock('../../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../../infrastructure/repositories/catalog-repository', () => ({
  MongoCatalogItemRepository,
}));

const { createCatalogItemAction } = await import('./actions');

function catalogItemFormData(): FormData {
  const fd = new FormData();
  fd.append('name', 'Asesoría básica');
  fd.append('unitPrice', '15000');
  fd.append('currency', 'COP');
  fd.append('type', 'service');
  // stock intentionally absent: services carry no stock.
  return fd;
}

describe('createCatalogItemAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoCatalogItemRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (item: unknown) => item),
    }));
  });

  it('returns the created item snapshot so the sale form can auto-select it', async () => {
    const result = await createCatalogItemAction(null, catalogItemFormData());

    expect(result.success).toBe('catalogItemCreated');
    expect(result.item).toBeTruthy();
    expect(result.item?.id).toBeTruthy();
    expect(result.item?.name).toBe('Asesoría básica');
    expect(result.item?.unitPrice.amount).toBe(15000);
    expect(result.item?.unitPrice.currency).toBe('COP');
    expect(revalidatePath).toHaveBeenCalledWith('/pos/catalog');
    expect(revalidatePath).toHaveBeenCalledWith('/pos/sales');
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await createCatalogItemAction(null, catalogItemFormData());

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCatalogItemRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});