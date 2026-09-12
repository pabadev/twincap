import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AccountModel } from '../../../infrastructure/models/account';
import { MovementModel } from '../../../infrastructure/models/movement';
import { IdempotencyModel } from '../../../infrastructure/models/idempotency';
import { OperationLogModel } from '../../../infrastructure/models/operation-log';

// R15.2 §37 — createAccountAction idempotency against a REAL Mongo replica
// set. Only the server-action plumbing that is impossible here (auth session,
// next/cache, analytics and the DB connection bootstrap) is mocked; the
// idempotency claim, repositories, unit of work and audit logger are all real.
//
// claimIdempotency (src/infrastructure/auth/idempotency.ts) returns ONLY a
// boolean: either the unique (userId, action, key) insert wins, or E11000
// maps to false. There is NO stored outcome to replay — the observable proof
// of "exactly one operation" is the document count (one account, one opening
// movement) plus the audit trail (one 'success', one 'duplicate').

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));

vi.mock('../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../infrastructure/db/connection', () => ({
  connectDb,
  // The real MongoOperationLogger consults isDbConnected() before writing.
  // Vitest throws when a mocked module lacks an export that code reaches, so
  // the mock must expose it; mongoose IS connected here (beforeAll above the
  // real replset), hence the live readyState check — audit logs are real.
  isDbConnected: () => mongoose.connection.readyState === 1,
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../lib/track-analytics', () => ({ trackAnalytics }));

const { createAccountAction, setInitialBalanceAction } = await import('./actions');

describe('createAccountAction idempotency — real Mongo (§37 R15.2)', () => {
  let mongod: MongoMemoryReplSet;

  // Real users have ObjectId workspaces (24 hex chars); the Mongo repos cast
  // workspaceId to ObjectId, so 'user-1' would throw a CastError here.
  const WS = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const USER_ID = 'user-1';

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: '7.0.41' },
      replSet: { count: 1, name: 'rs0' },
    });
    await mongoose.connect(mongod.getUri('twincap_37'));
    // The unique (userId, action, key) index is deployed by the ensure
    // scripts in production; here model init must be explicit — autoIndex is
    // not deterministic on a fresh replset (same pattern as rate-limiter and
    // monitor-guard suite tests).
    await IdempotencyModel.init();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await MovementModel.deleteMany({});
    await IdempotencyModel.deleteMany({});
    await OperationLogModel.deleteMany({});
    getCurrentUser.mockResolvedValue({ userId: USER_ID, workspaceId: WS });
    connectDb.mockResolvedValue(undefined);
    revalidatePath.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);
  });

  function createAccountFormData(key: string, name = 'Caja diaria'): FormData {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('currency', 'COP');
    fd.append('initialBalance', '50000');
    fd.append('idempotencyKey', key);
    return fd;
  }

  it('lost-response retry: the same key replays as duplicateRequest and creates NOTHING twice', async () => {
    const fd = createAccountFormData('key-lost-response');

    const first = await createAccountAction(null, fd);
    expect(first).toEqual({ success: 'accountCreated' });

    // The client never saw the first response → it resubmits the SAME request.
    const retry = await createAccountAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });

    // Exactly one observable operation: one account + one opening movement.
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    // The claim stays consumed (no release on success — TTL 24h).
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID })).toBe(1);
  });

  it('audit trail records exactly one success and one duplicate for the same key', async () => {
    const fd = createAccountFormData('key-audit');

    await createAccountAction(null, fd);
    await createAccountAction(null, fd);

    expect(await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createAccount' })).toBe(2);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createAccount', result: 'success' }),
    ).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createAccount', result: 'duplicate' }),
    ).toBe(1);
  });

  it('concurrent duplicates with the same key: exactly one wins, one duplicate, no double ledger', async () => {
    const fd = createAccountFormData('key-concurrent');

    const results = await Promise.all([
      createAccountAction(null, fd),
      createAccountAction(null, fd),
    ]);

    // Deterministic outcome regardless of winner order: one success, one duplicate.
    expect(results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
      { error: 'error.duplicateRequest' },
      { success: 'accountCreated' },
    ]);
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
  });

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and commits NOTHING', async () => {
    const fd = createAccountFormData('key-post-commit-failure');
    // The financial mutation commits, then the FIRST post-commit task
    // (revalidatePath) throws synchronously — exactly the P1.2
    // release-after-commit defect.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const first = await createAccountAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation committed exactly once (one account + one opening movement)
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    // (d) the claim was NOT released — the key stays consumed
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'createAccount' })).toBe(1);

    // (c) retry with the SAME key → deterministic duplicate, commits NOTHING
    const retry = await createAccountAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
  });

  it('§21 R15.3.1 setInitialBalance: post-commit revalidatePath failure never releases the key — retry replays as duplicate and commits NOTHING', async () => {
    const accountId = new mongoose.Types.ObjectId().toString();
    await AccountModel.create({
      _id: new mongoose.Types.ObjectId(accountId),
      workspaceId: new mongoose.Types.ObjectId(WS),
      name: 'Caja',
      currency: 'COP',
      isFixed: false,
    });

    const fd = new FormData();
    fd.append('accountId', accountId);
    fd.append('amount', '100000');
    fd.append('idempotencyKey', 'key-post-commit-failure-balance');

    // Opening movement commits, then the FIRST post-commit revalidatePath
    // throws synchronously.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const first = await setInitialBalanceAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation committed exactly once (one opening movement)
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'setInitialBalance', result: 'success' }),
    ).toBe(1);
    // (d) the claim was NOT released — the key stays consumed
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'setInitialBalance' })).toBe(1);

    // (c) retry with the SAME key → deterministic duplicate, commits NOTHING
    const retry = await setInitialBalanceAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'setInitialBalance', result: 'success' }),
    ).toBe(1);
  });
});