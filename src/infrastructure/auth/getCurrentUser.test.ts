import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env BEFORE any module import that triggers parseEnv (session.ts → env)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.AUTH_SECRET = 'BOSQ3eUPIOigpsbEksIBEyDceVCvMHMXtBqSwWbA6l8';

const { getCurrentUser } = await import('./getCurrentUser');

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

const { getSessionCookie } = await import('./session-cookie');
const { connectDb } = await import('../db/connection');
const { MongoMembershipRepository } = await import('../repositories/membership-repository');

const mockedGetSessionCookie = vi.mocked(getSessionCookie);
const mockedConnectDb = vi.mocked(connectDb);
const mockedMembershipRepoClass = vi.mocked(MongoMembershipRepository);

function makeActiveMembership(workspaceId: string) {
  return { id: 'm-1', userId: 'user-1', workspaceId, role: 'owner', status: 'active', createdAt: new Date() };
}

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no session (no sub)', async () => {
    mockedGetSessionCookie.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(connectDb).not.toHaveBeenCalled();
  });

  it('returns workspaceId from the session claim when present', async () => {
    mockedGetSessionCookie.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      workspaceId: 'ws-1',
    });

    const result = await getCurrentUser();
    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com', workspaceId: 'ws-1' });
    // No DB fallback needed when the claim already carries workspaceId
    expect(connectDb).not.toHaveBeenCalled();
    expect(mockedMembershipRepoClass).not.toHaveBeenCalled();
  });

  it('resolves workspaceId from DB when the claim is missing (legacy session)', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
    findByUserId.mockResolvedValue([makeActiveMembership('ws-db-1')]);

    const result = await getCurrentUser();
    expect(connectDb).toHaveBeenCalled();
    expect(mockedMembershipRepoClass).toHaveBeenCalledTimes(1);
    expect(findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com', workspaceId: 'ws-db-1' });
  });

  it('returns undefined workspaceId when no active membership exists', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1' });
    findByUserId.mockResolvedValue([]);

    const result = await getCurrentUser();
    expect(result).toEqual({ userId: 'user-1', workspaceId: undefined });
  });

  it('ignores non-active memberships and returns the first active one', async () => {
    mockedGetSessionCookie.mockResolvedValue({ sub: 'user-1' });
    findByUserId.mockResolvedValue([
      { id: 'm-invited', userId: 'user-1', workspaceId: 'ws-invited', role: 'owner', status: 'invited', createdAt: new Date() },
      makeActiveMembership('ws-active'),
    ]);

    const result = await getCurrentUser();
    expect(result?.workspaceId).toBe('ws-active');
  });
});
