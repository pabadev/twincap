import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCategory } from './create-category';
import { updateCategory } from './update-category';
import { deleteCategory } from './delete-category';
import { listCategories } from './list-categories';
import { Category } from '../../domain/category';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { CategoryRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';

// ─── Fake factories ────────────────────────────────────────────────

let idCounter = 0;

function fakeCategoryRepo(
  overrides: Partial<CategoryRepository> = {},
): CategoryRepository & { created: Category[]; deleted: string[]; updated: Category[] } {
  const created: Category[] = [];
  const deleted: string[] = [];
  const updated: Category[] = [];
  return {
    created,
    deleted,
    updated,
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByNameAndType: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (category: Category) => {
      created.push(category);
      return category;
    }),
    update: vi.fn().mockImplementation(async (category: Category) => {
      updated.push(category);
      return category;
    }),
    delete: vi.fn().mockImplementation(async (_userId: string, id: string) => {
      deleted.push(id);
    }),
    ...overrides,
  };
}

function fakeMovementRepo(
  overrides: Partial<MovementRepository> = {},
): MovementRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    ...overrides,
  };
}

function fakeIdGen(): IdGenerator {
  return { generate: () => `id-${++idCounter}` };
}

function makeCategory(overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}): Category {
  return new Category({
    id: 'cat-1',
    userId: 'user-1',
    name: 'Salary',
    type: 'income',
    createdAt: new Date(),
    ...overrides,
  });
}

beforeEach(() => {
  idCounter = 0;
});

// ─── Create ────────────────────────────────────────────────────────

describe('createCategory', () => {
  it('creates a category with the given name and type', async () => {
    const categoryRepo = fakeCategoryRepo();
    const ids = fakeIdGen();

    const category = await createCategory(
      'user-1',
      { name: 'Salary', type: 'income' },
      categoryRepo,
      ids,
    );

    expect(category.name).toBe('Salary');
    expect(category.type).toBe('income');
    expect(categoryRepo.created).toHaveLength(1);
  });

  it('throws ConflictError on duplicate name+type', async () => {
    const existing = makeCategory();
    const categoryRepo = fakeCategoryRepo({
      findByNameAndType: vi.fn().mockResolvedValue(existing),
    });
    const ids = fakeIdGen();

    await expect(
      createCategory(
        'user-1',
        { name: 'Salary', type: 'income' },
        categoryRepo,
        ids,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('trims whitespace from name', async () => {
    const categoryRepo = fakeCategoryRepo();
    const ids = fakeIdGen();

    const category = await createCategory(
      'user-1',
      { name: '  Salary  ', type: 'income' },
      categoryRepo,
      ids,
    );

    expect(category.name).toBe('Salary');
  });
});

// ─── Update ────────────────────────────────────────────────────────

describe('updateCategory', () => {
  it('updates the category name', async () => {
    const existing = makeCategory();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateCategory(
      'user-1',
      { categoryId: 'cat-1', name: 'New Salary' },
      categoryRepo,
    );

    expect(updated.name).toBe('New Salary');
    expect(updated.type).toBe('income'); // type unchanged
    expect(categoryRepo.updated).toHaveLength(1);
  });

  it('throws NotFoundError when category does not exist', async () => {
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(null),
    });

    await expect(
      updateCategory('user-1', { categoryId: 'missing', name: 'X' }, categoryRepo),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError on duplicate name+type', async () => {
    const existing = makeCategory();
    const duplicate = makeCategory({ id: 'cat-2', name: 'Freelance' });
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(existing),
      findByNameAndType: vi.fn().mockResolvedValue(duplicate),
    });

    await expect(
      updateCategory('user-1', { categoryId: 'cat-1', name: 'Freelance' }, categoryRepo),
    ).rejects.toThrow(ConflictError);
  });

  it('allows keeping the same name without uniqueness check', async () => {
    const existing = makeCategory();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(existing),
    });

    const updated = await updateCategory(
      'user-1',
      { categoryId: 'cat-1', name: 'Salary' },
      categoryRepo,
    );

    expect(updated.name).toBe('Salary');
    // findByNameAndType should not be called when name hasn't changed
    expect(categoryRepo.findByNameAndType).not.toHaveBeenCalled();
  });
});

// ─── Delete ────────────────────────────────────────────────────────

describe('deleteCategory', () => {
  it('deletes a category with no movements', async () => {
    const category = makeCategory();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const movementRepo = fakeMovementRepo();

    await deleteCategory('user-1', 'cat-1', categoryRepo, movementRepo);

    expect(categoryRepo.deleted).toContain('cat-1');
  });

  it('throws ConflictError when category has movements', async () => {
    const category = makeCategory();
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(category),
    });
    const movementRepo = fakeMovementRepo({
      countByCategoryId: vi.fn().mockResolvedValue(3),
    });

    await expect(
      deleteCategory('user-1', 'cat-1', categoryRepo, movementRepo),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when category does not exist', async () => {
    const categoryRepo = fakeCategoryRepo({
      findById: vi.fn().mockResolvedValue(null),
    });
    const movementRepo = fakeMovementRepo();

    await expect(
      deleteCategory('user-1', 'missing', categoryRepo, movementRepo),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── List ──────────────────────────────────────────────────────────

describe('listCategories', () => {
  it('returns all categories for the user', async () => {
    const categories = [
      makeCategory({ id: 'c1', name: 'Salary' }),
      makeCategory({ id: 'c2', name: 'Freelance' }),
    ];
    const categoryRepo = fakeCategoryRepo({
      findByUserId: vi.fn().mockResolvedValue(categories),
    });

    const result = await listCategories('user-1', categoryRepo);

    expect(result).toHaveLength(2);
    expect(categoryRepo.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
