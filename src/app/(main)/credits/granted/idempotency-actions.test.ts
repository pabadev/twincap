import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AccountModel } from '../../../../infrastructure/models/account';
import { MovementModel } from '../../../../infrastructure/models/movement';
import { CreditGrantedModel } from '../../../../infrastructure/models/credit-granted';
import { IdempotencyModel } from '../../../../infrastructure/models/idempotency';
import { OperationLogModel } from '../../../../infrastructure/models/operation-log';

// R15.3.1 §21 — createCreditGrantedAction post-commit-failure idempotency
// against a REAL Mongo replica set. Only the server-action plumbing that is
// impossible here (auth session, next/cache, analytics and the DB connection
// bootstrap) is mocked; the idempotency claim, repositories, unit of work and
// audit logger are all real. revalidatePath is the injected post-commit failure
// point: the mutation commits, then revalidateMovementData's first revalidate
// call rejects. The key must stay consumed — a retry must replay as duplicate.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));

vi.mock('../../../../infrastructure/auth/getCurrentUser', () => ({ getCurrentUser }));
vi.mock('../../../../infrastructure/db/connection', () => ({
  connectDb,
  // The real MongoOperationLogger consults isDbConnected() before writing.
  // Vitest throws when a mocked module lacks an export that code reaches, so
  // the mock must expose it; mongoose IS connected here (beforeAll above the
  // real replset), hence the live readyState check — audit logs are real.
  isDbConnected: () => mongoose.connection.readyState === 1,
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../../../lib/track-analytics', () => ({ trackAnalytics }));

const { createCreditGrantedAction } = await import('./actions');

describe('createCreditGrantedAction idempotency — real Mongo (§21 R15.3.1)', () => {
  let mongod: MongoMemoryReplSet;

  // Real users have ObjectId workspaces (24 hex chars); the Mongo repos cast
  // workspaceId to ObjectId, so 'user-1' would throw a CastError here.
  const WS = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const USER_ID = 'user-1';
  let accountId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: '7.0.41' },
      replSet: { count: 1, name: 'rs0' },
    });
    await mongoose.connect(mongod.getUri('twincap_1531_granted'));
    // The unique (userId, action, key) index is deployed by the ensure
    // scripts in production; here model init must be explicit — autoIndex is
    // not deterministic on a fresh replset (same pattern as the accounts and
    // rate-limiter suite tests).
    await IdempotencyModel.init();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await MovementModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await IdempotencyModel.deleteMany({});
    await OperationLogModel.deleteMany({});
    getCurrentUser.mockResolvedValue({ userId: USER_ID, workspaceId: WS });
    connectDb.mockResolvedValue(undefined);
    revalidatePath.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);

    const account = await AccountModel.create({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: new mongoose.Types.ObjectId(WS),
      name: 'Caja diaria',
      currency: 'COP',
      isFixed: false,
    });
    accountId = account._id.toString();
  });

  function createCreditFormData(key: string): FormData {
    const fd = new FormData();
    fd.append('counterparty', 'Pedro');
    fd.append('principal', '500000');
    fd.append('currency', 'COP');
    fd.append('accountId', accountId);
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', key);
    return fd;
  }

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and commits NOTHING', async () => {
    const fd = createCreditFormData('key-granted-post-commit-failure');
    // The financial mutation commits, then the FIRST post-commit revalidatePath
    // (inside revalidateMovementData) throws synchronously — the P1.2 defect path.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const first = await createCreditGrantedAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation committed exactly once (one credit + one principal movement)
    expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createCreditGranted', result: 'success' }),
    ).toBe(1);
    // (d) the claim was NOT released — the key stays consumed
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'createCreditGranted' })).toBe(1);

    // (c) retry with the SAME key → deterministic duplicate, commits NOTHING
    const retry = await createCreditGrantedAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
  });
});