import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AccountModel } from '../../../infrastructure/models/account';
import { TransferModel } from '../../../infrastructure/models/transfer';
import { MovementModel } from '../../../infrastructure/models/movement';
import { IdempotencyModel } from '../../../infrastructure/models/idempotency';
import { OperationLogModel } from '../../../infrastructure/models/operation-log';

// R15.3.1 §21 — createTransferAction post-commit-failure idempotency against a
// REAL Mongo replica set. Only the server-action plumbing that is impossible
// here (auth session, next/cache, analytics and the DB connection bootstrap) is
// mocked; the idempotency claim, repositories, unit of work and audit logger
// are all real. revalidatePath is the injected post-commit failure point: the
// transfer commits, then the first revalidate call rejects. The key must stay
// consumed — a retry must replay as duplicate and commit NOTHING.
//
// A second test pins the R15.1 F5 pre-commit release: a warning writes NOTHING
// and re-arms the key (that release is deliberately OUTSIDE the committed
// scope, so the P1.2 fix must not disturb it).

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

const { createTransferAction } = await import('./actions');

describe('createTransferAction idempotency — real Mongo (§21 R15.3.1)', () => {
  let mongod: MongoMemoryReplSet;

  // Real users have ObjectId workspaces (24 hex chars); the Mongo repos cast
  // workspaceId to ObjectId, so 'user-1' would throw a CastError here.
  const WS = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const USER_ID = 'user-1';
  let sourceAccountId: string;
  let destinationAccountId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: '7.0.41' },
      replSet: { count: 1, name: 'rs0' },
      // Wider launch window than the 10s default: first spawn after a fresh
      // extraction (or under AV scanning) is slow on Windows and the default
      // times out intermittently, even though the binary is healthy.
      instanceOpts: [{ launchTimeout: 45_000 }],
    });
    await mongoose.connect(mongod.getUri('twincap_1531_transfers'));
    // The unique (userId, action, key) index is deployed by the ensure
    // scripts in production; here model init must be explicit — autoIndex is
    // not deterministic on a fresh replset (same pattern as the accounts and
    // rate-limiter suite tests).
    await IdempotencyModel.init();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await TransferModel.deleteMany({});
    await MovementModel.deleteMany({});
    await IdempotencyModel.deleteMany({});
    await OperationLogModel.deleteMany({});
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: USER_ID, workspaceId: WS });
    connectDb.mockResolvedValue(undefined);
    revalidatePath.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);

    const source = await AccountModel.create({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: new mongoose.Types.ObjectId(WS),
      name: 'Caja diaria',
      currency: 'COP',
      isFixed: false,
    });
    sourceAccountId = source._id.toString();
    const destination = await AccountModel.create({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: new mongoose.Types.ObjectId(WS),
      name: 'Banco',
      currency: 'COP',
      isFixed: false,
    });
    destinationAccountId = destination._id.toString();
  });

  function createTransferFormData(key: string, confirmNegativeBalance = false): FormData {
    const fd = new FormData();
    fd.append('sourceAccountId', sourceAccountId);
    fd.append('destinationAccountId', destinationAccountId);
    fd.append('sourceAmount', '50000');
    fd.append('sourceCurrency', 'COP');
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('idempotencyKey', key);
    if (confirmNegativeBalance) fd.append('confirmNegativeBalance', 'true');
    return fd;
  }

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and commits NOTHING', async () => {
    const fd = createTransferFormData('key-trf-post-commit-failure', true);
    // The financial mutation commits, then the FIRST post-commit
    // revalidatePath THROWS SYNCHRONOUSLY — the P1.2 defect path. revalidatePath
    // is deliberately un-awaited in the action (R15.1 6b), so a rejected
    // promise would float as an unhandled rejection and never reach the catch:
    // the sync throw is the observable contract (same as the accounts §21 test).
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const first = await createTransferAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();
    // the flow aborted at revalidatePath: analytics never reached
    expect(trackAnalytics).not.toHaveBeenCalled();

    // (a) the mutation committed exactly once (one transfer + two movements)
    expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createTransfer', result: 'success' }),
    ).toBe(1);
    // (d) the claim was NOT released — the key stays consumed
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'createTransfer' })).toBe(1);

    // (c) retry with the SAME key → deterministic duplicate, commits NOTHING
    const retry = await createTransferAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createTransfer', result: 'duplicate' }),
    ).toBe(1);
  });

  it('F5 warning (nothing written) still releases the claim pre-commit — the same key can be retried', async () => {
    // No confirmNegativeBalance and a zero derived source balance → the use
    // case returns the structured warning and writes NOTHING. The explicit
    // pre-commit release must survive the P1.2 fix.
    const fd = createTransferFormData('key-trf-warning', false);

    const result = await createTransferAction(null, fd);

    expect(result).toEqual({
      warning: { type: 'insufficient_funds', currentBalance: 0, projectedBalance: -50000, currency: 'COP' },
    });
    expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(0);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    // Pre-commit release: the claim is gone, so the user can retry the SAME key.
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'createTransfer' })).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});