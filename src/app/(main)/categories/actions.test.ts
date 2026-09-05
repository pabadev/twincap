import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCategoryRepository } = vi.hoisted(() => ({
  MongoCategoryRepository: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({ connectDb }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../infrastructure/repositories/category-repository', () => ({
  MongoCategoryRepository,
}));

const { updateCategoryAction } = await import('./actions');

function categoryEntity() {
  return {
    id: 'cat-1',
    workspaceId: 'user-1',
    name: 'Comida',
    type: 'expense',
    createdAt: new Date(),
  };
}

function renameFormData(name = 'Alimentación'): FormData {
  const fd = new FormData();
  fd.append('categoryId', 'cat-1');
  fd.append('name', name);
  return fd;
}

describe('updateCategoryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: 'user-1', workspaceId: 'user-1' });
    connectDb.mockResolvedValue(undefined);
    MongoCategoryRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(categoryEntity()),
      findByNameAndType: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('renames the category and returns the success toast key', async () => {
    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ success: 'categoryUpdated' });
    expect(revalidatePath).toHaveBeenCalledWith('/categories');
    expect(revalidatePath).toHaveBeenCalledWith('/movements');
  });

  it('maps a missing category to the notFound error key', async () => {
    MongoCategoryRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(null),
    }));

    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ error: 'error.notFound' });
  });

  it('rejects unauthenticated callers before any data access', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateCategoryAction(null, renameFormData());

    expect(result).toEqual({ error: 'error.unauthorized' });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCategoryRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});