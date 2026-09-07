import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env BEFORE any module import that triggers parseEnv (session.ts → env)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AUTH_SECRET = 'BOSQ3eUPIOigpsbEksIBEyDceVCvMHMXtBqSwWbA6l8';

// ─── Mocks ─────────────────────────────────────────────────────────

vi.mock('./session-cookie', () => ({
  getSessionCookie: vi.fn(),
}));

vi.mock('../db/connection', () => ({
  connectDb: vi.fn().mockResolvedValue({}),
}));

// findByUserId is a standalone mock so each test can point the repo at a fresh fn.
const findByUserId = vi.fn();

vi.mock('../repositories/membership-repository', () => ({
  MongoMembershipRepository: vi.fn().mockImplementation(() => ({ findByUserId })),
}));

// findById is a standalone mock so each test can point the repo at a fresh fn.
const findById = vi.fn();

vi.mock('../repositories/user-repository', () => ({
  MongoUserRepository: vi.fn().mockImplementation(() => ({ findById })),
}));

const { getCurrentUser } = await import('./getCurrentUser');
const { getSessionCookie } = await import('./session-cookie');
const { connectDb } = await import('../db/connection');
const { MongoMembershipRepository } = await import('../repositories/membership-repository');
const { MongoUserRepository } = await import('../repositories/user-repository');

const mockedGetSessionCookie = vi.mocked(getSessionCookie);
const mockedMembershipRepoClass = vi.mocked(MongoMembershipRepository);
const mockedUserRepoClass = vi.mocked(MongoUserRepository);

function makeActiveMembership(workspaceId: string) {
  return { id: 'm-1', userId: 'user-1', workspaceId, role: 'owner', status: 'active', createdAt: new Date() };
}

interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  locale?: string;
  emailVerified?: boolean;
  createdAt: Date;
  sessionVersion: number;
}

function makeDbUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed:x',
    createdAt: new Date(),
    sessionVersion: 0,
    ...overrides,
  };
}

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no session (no sub) — no DB read', async () => {
    mockedGetSessionCookie.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(connectDb).not.toHaveBeenCalled();
  });

  it('returns null when the user no longer exists (R14-F §13)', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
      sessionVersion: 0,
    });
    findById.mockResolvedValue(null);

    const result = await getCurrentUser();
    expect(result).toBeNull();
    expect(connectDb).toHaveBeenCalled();
    expect(mockedUserRepoClass).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the session sessionVersion mismatches the user (stale session, R14-F §13)', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
      sessionVersion: 0,
    });
    // Password was changed after this session was minted → user version is 1.
    findById.mockResolvedValue(makeDbUser({ sessionVersion: 1 }));

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when the session has no sessionVersion but the user has one (legacy session vs hardened user)', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
    });
    findById.mockResolvedValue(makeDbUser({ sessionVersion: 3 }));

    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns the payload claims when sessionVersion matches (R14-F §13)', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
      sessionVersion: 2,
    });
    findById.mockResolvedValue(makeDbUser({ sessionVersion: 2 }));

    const result = await getCurrentUser();
    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com', workspaceId: 'ws-1' });
    expect(connectDb).toHaveBeenCalled();
    expect(mockedMembershipRepoClass).not.toHaveBeenCalled();
  });

  it('treats a missing sessionVersion claim as 0 and matches a version-0 user (legacy user)', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
    });
    findById.mockResolvedValue(makeDbUser({ sessionVersion: 0 }));

    const result = await getCurrentUser();
    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com', workspaceId: 'ws-1' });
  });

  it('resolves workspaceId from DB when the claim is missing (legacy session)', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
    findById.mockResolvedValue(makeDbUser());
    findByUserId.mockResolvedValue([makeActiveMembership('ws-db-1')]);

    const result = await getCurrentUser();
    expect(connectDb).toHaveBeenCalled();
    expect(mockedUserRepoClass).toHaveBeenCalledTimes(1);
    expect(mockedMembershipRepoClass).toHaveBeenCalledTimes(1);
    expect(findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com', workspaceId: 'ws-db-1' });
  });

  it('returns undefined workspaceId when no active membership exists', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1' });
    findById.mockResolvedValue(makeDbUser());
    findByUserId.mockResolvedValue([]);

    const result = await getCurrentUser();
    expect(result).toEqual({ userId: 'user-1', workspaceId: undefined });
  });

  it('ignores non-active memberships and returns the first active one', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1' });
    findById.mockResolvedValue(makeDbUser());
    findByUserId.mockResolvedValue([
      { id: 'm-invited', userId: 'user-1', workspaceId: 'ws-invited', role: 'owner', status: 'invited', createdAt: new Date() },
      makeActiveMembership('ws-active'),
    ]);

    const result = await getCurrentUser();
    expect(result?.workspaceId).toBe('ws-active');
  });
});