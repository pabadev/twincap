import { describe, it, expect, vi } from 'vitest';
import { register } from './register';
import { login } from './login';
import { logout } from './logout';
import { ValidationError, ConflictError } from '../../domain/errors';
import type { UserRepository, AccountRepository, CategoryRepository, WorkspaceRepository, MembershipRepository } from '../../domain/repositories';
import type { PasswordHasher, IdGenerator } from '../ports';
import type { User } from '../../domain/user';
import type { Account } from '../../domain/account';
import type { Category } from '../../domain/category';
import type { Workspace } from '../../domain/workspace';
import type { Membership } from '../../domain/membership';

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

function fakeWorkspaceRepo(): WorkspaceRepository & { created: Workspace[] } {
  const created: Workspace[] = [];
  return {
    created,
    findById: async () => null,
    create: async (workspace) => {
      created.push(workspace);
      return workspace;
    },
    update: async (w) => w,
    delete: async () => {},
  };
}

function fakeMembershipRepo(): MembershipRepository & { created: Membership[] } {
  const created: Membership[] = [];
  return {
    created,
    findById: async () => null,
    findActiveByUserAndWorkspace: async () => null,
    findByUserId: async () => [],
    create: async (membership) => {
      created.push(membership);
      return membership;
    },
    update: async (m) => m,
    delete: async () => {},
  };
}

function fakeIdGen(id = 'test-user-id'): IdGenerator {
  return { generate: () => id };
}

// ─── Register ──────────────────────────────────────────────────────

describe('register', () => {
  it('creates user and seeds accounts + categories', async () => {
    const userRepo = fakeUserRepo();
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();
    const hasher = fakeHasher();
    const ids = fakeIdGen();
    const workspaceRepo = fakeWorkspaceRepo();
    const membershipRepo = fakeMembershipRepo();

    const result = await register(
      { email: 'test@example.com', password: 'password123' },
      userRepo,
      accountRepo,
      categoryRepo,
      hasher,
      ids,
      workspaceRepo,
      membershipRepo,
    );

    expect(result.userId).toBe('test-user-id');
    expect(result.email).toBe('test@example.com');
    expect(userRepo.created).toHaveLength(1);
    expect(userRepo.created[0].email).toBe('test@example.com');
    expect(seedUser).toHaveBeenCalledWith('test-user-id', accountRepo, categoryRepo);
  });

  it('creates a personal Workspace and owner Membership on registration', async () => {
    const userRepo = fakeUserRepo();
    const accountRepo = fakeAccountRepo();
    const categoryRepo = fakeCategoryRepo();
    const hasher = fakeHasher();
    const ids = fakeIdGen();
    const workspaceRepo = fakeWorkspaceRepo();
    const membershipRepo = fakeMembershipRepo();

    const result = await register(
      { email: 'test@example.com', password: 'password123' },
      userRepo,
      accountRepo,
      categoryRepo,
      hasher,
      ids,
      workspaceRepo,
      membershipRepo,
    );

    // Personal workspace: ownerId = new user id
    expect(workspaceRepo.created).toHaveLength(1);
    const workspace = workspaceRepo.created[0];
    expect(workspace.ownerId).toBe('test-user-id');
    expect(workspace.name).toBe('Mi espacio');

    // Owner membership linking user → workspace
    expect(membershipRepo.created).toHaveLength(1);
    const membership = membershipRepo.created[0];
    expect(membership.userId).toBe('test-user-id');
    expect(membership.workspaceId).toBe(workspace.id);
    expect(membership.role).toBe('owner');

    // Output carries the workspaceId
    expect(result.workspaceId).toBe(workspace.id);
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
        fakeIdGen(),
        fakeWorkspaceRepo(),
        fakeMembershipRepo(),
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
        fakeIdGen(),
        fakeWorkspaceRepo(),
        fakeMembershipRepo(),
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
    expect(result.email).toBe('test@example.com');
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
