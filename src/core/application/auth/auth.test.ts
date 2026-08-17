import { describe, it, expect, vi } from 'vitest';
import { register } from './register';
import { login } from './login';
import { logout } from './logout';
import { ValidationError, ConflictError } from '../../domain/errors';
import type { UserRepository, AccountRepository, CategoryRepository } from '../../domain/repositories';
import type { PasswordHasher, IdGenerator } from '../ports';
import type { User } from '../../domain/user';
import type { Account } from '../../domain/account';
import type { Category } from '../../domain/category';

// ─── Mocks ─────────────────────────────────────────────────────────

vi.mock('../../../infrastructure/seeding/user-bootstrap', () => ({
  seedUser: vi.fn(),
}));

vi.mock('../../../infrastructure/auth/session-cookie', () => ({
  deleteSessionCookie: vi.fn(),
}));

const { seedUser } = await import('../../../infrastructure/seeding/user-bootstrap');
const { deleteSessionCookie } = await import('../../../infrastructure/auth/session-cookie');

// ─── Fake factories ────────────────────────────────────────────────

function fakeUserRepo(findResult: User | null = null): UserRepository & { created: User[] } {
  const created: User[] = [];
  return {
    created,
    findById: async () => null,
    findByEmail: async () => findResult,
    create: async (user) => {
      created.push(user);
      return user;
    },
    update: async (user) => user,
    delete: async () => {},
  };
}

function fakeAccountRepo(): AccountRepository & { created: Account[] } {
  const created: Account[] = [];
  return {
    created,
    findById: async () => null,
    findByUserId: async () => [],
    create: async (account) => {
      created.push(account);
      return account;
    },
    update: async (a) => a,
    delete: async () => {},
    countReferences: async () => 0,
  };
}

function fakeCategoryRepo(): CategoryRepository & { created: Category[] } {
  const created: Category[] = [];
  return {
    created,
    findById: async () => null,
    findByUserId: async () => [],
    findByNameAndType: async () => null,
    create: async (category) => {
      created.push(category);
      return category;
    },
    update: async (c) => c,
    delete: async () => {},
  };
}

function fakeHasher(): PasswordHasher {
  return {
    hash: async (plain) => `hashed:${plain}`,
    compare: async (plain, hashed) => hashed === `hashed:${plain}`,
  };
}

function fakeIdGen(id = 'test-user-id'): IdGenerator {
  return { generate: () => id };
}

const fakeSessions = { create: vi.fn(), verify: vi.fn() };

// ─── Register ──────────────────────────────────────────────────────

describe('register', () => {
  it('creates user and seeds accounts + categories', async () => {
    const userRepo = fakeUserRepo();
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();
    const hasher = fakeHasher();
    const ids = fakeIdGen();

    const result = await register(
      { email: 'test@example.com', password: 'password123' },
      userRepo,
      accountRepo,
      categoryRepo,
      hasher,
      fakeSessions,
      ids,
    );

    expect(result.userId).toBe('test-user-id');
    expect(userRepo.created).toHaveLength(1);
    expect(userRepo.created[0].email).toBe('test@example.com');
    expect(seedUser).toHaveBeenCalledWith('test-user-id', accountRepo, categoryRepo);
  });

  it('rejects duplicate email', async () => {
    const existing = {
      id: 'existing',
      email: 'test@example.com',
      passwordHash: 'hash',
      createdAt: new Date(),
    } as User;
    const userRepo = fakeUserRepo(existing);

    await expect(
      register(
        { email: 'test@example.com', password: 'password123' },
        userRepo,
        fakeAccountRepo(),
        fakeCategoryRepo(),
        fakeHasher(),
        fakeSessions,
        fakeIdGen(),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects short password', async () => {
    await expect(
      register(
        { email: 'test@example.com', password: 'short' },
        fakeUserRepo(),
        fakeAccountRepo(),
        fakeCategoryRepo(),
        fakeHasher(),
        fakeSessions,
        fakeIdGen(),
      ),
    ).rejects.toThrow(ValidationError);
  });
});

// ─── Login ─────────────────────────────────────────────────────────

describe('login', () => {
  it('returns userId for valid credentials', async () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashed:password123',
      createdAt: new Date(),
    } as User;
    const userRepo = fakeUserRepo(user);

    const result = await login(
      { email: 'test@example.com', password: 'password123' },
      userRepo,
      fakeHasher(),
    );

    expect(result.userId).toBe('user-1');
  });

  it('rejects wrong password with generic message', async () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashed:correct',
      createdAt: new Date(),
    } as User;
    const userRepo = fakeUserRepo(user);

    await expect(
      login(
        { email: 'test@example.com', password: 'wrong' },
        userRepo,
        fakeHasher(),
      ),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects nonexistent email with same generic message', async () => {
    await expect(
      login(
        { email: 'nobody@example.com', password: 'password123' },
        fakeUserRepo(),
        fakeHasher(),
      ),
    ).rejects.toThrow('Invalid email or password');
  });
});

// ─── Logout ────────────────────────────────────────────────────────

describe('logout', () => {
  it('calls deleteSessionCookie', async () => {
    vi.mocked(deleteSessionCookie).mockClear();
    await logout();
    expect(deleteSessionCookie).toHaveBeenCalledOnce();
  });
});
