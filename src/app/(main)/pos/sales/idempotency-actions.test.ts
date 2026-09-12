import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AccountModel } from '../../../../infrastructure/models/account';
import { CatalogItemModel } from '../../../../infrastructure/models/catalog';
import { SaleModel } from '../../../../infrastructure/models/sale';
import { MovementModel } from '../../../../infrastructure/models/movement';
import { IdempotencyModel } from '../../../../infrastructure/models/idempotency';
import { OperationLogModel } from '../../../../infrastructure/models/operation-log';

// R15.3.1 §21 — createSaleAction post-commit-failure idempotency against a
// REAL Mongo replica set. Only the server-action plumbing that is impossible
// here (auth session, next/cache, analytics and the DB connection bootstrap) is
// mocked; the idempotency claim, repositories, unit of work and audit logger
// are all real. revalidatePath is the injected post-commit failure point: the
// sale commits, then the first revalidate call rejects. The key must stay
// consumed — a retry must replay as duplicate and commit NOTHING.

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

const { createSaleAction } = await import('./actions');

describe('createSaleAction idempotency — real Mongo (§21 R15.3.1)', () => {
  let mongod: MongoMemoryReplSet;

  // Real users have ObjectId workspaces (24 hex chars); the Mongo repos cast
  // workspaceId to ObjectId, so 'user-1' would throw a CastError here.
  const WS = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const USER_ID = 'user-1';
  let accountId: string;
  let itemId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: '7.0.41' },
      replSet: { count: 1, name: 'rs0' },
      // Wider launch window than the 10s default: first spawn after a fresh
      // extraction (or under AV scanning) is slow on Windows and the default
      // times out intermittently, even though the binary is healthy.
      instanceOpts: [{ launchTimeout: 45_000 }],
    });
    await mongoose.connect(mongod.getUri('twincap_1531_pos'));
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
    await CatalogItemModel.deleteMany({});
    await SaleModel.deleteMany({});
    await MovementModel.deleteMany({});
    await IdempotencyModel.deleteMany({});
    await OperationLogModel.deleteMany({});
    vi.clearAllMocks();
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
    const item = await CatalogItemModel.create({
      _id: new mongoose.Types.ObjectId(),
      workspaceId: new mongoose.Types.ObjectId(WS),
      name: 'Servicio técnico',
      unitPrice: 15000,
      currency: 'COP',
      type: 'service',
    });
    itemId = item._id.toString();
  });

  function createSaleFormData(key: string): FormData {
    const fd = new FormData();
    fd.append('lineItems', JSON.stringify([{ itemId, quantity: 1, unitPrice: 15000 }]));
    fd.append('accountId', accountId);
    fd.append('date', '2026-09-01');
    fd.append('tzOffset', '300');
    fd.append('paymentMode', 'paid-in-full');
    fd.append('currency', 'COP');
    fd.append('idempotencyKey', key);
    return fd;
  }

  it('§21 R15.3.1: post-commit revalidatePath failure never releases the key — retry replays as duplicate and commits NOTHING', async () => {
    const fd = createSaleFormData('key-pos-post-commit-failure');
    // The financial mutation commits, then the FIRST post-commit
    // revalidatePath THROWS SYNCHRONOUSLY — the P1.2 defect path. revalidatePath
    // is deliberately un-awaited in the action (R15.1 6b), so a rejected
    // promise would float as an unhandled rejection and never reach the catch:
    // the sync throw is the observable contract (same as the accounts §21 test).
    revalidatePath.mockImplementationOnce(() => {
      throw new Error('post-commit revalidate boom');
    });

    const first = await createSaleAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: 'error.operationFailed' });
    expect(revalidatePath).toHaveBeenCalled();
    // the flow aborted at revalidatePath: analytics never reached
    expect(trackAnalytics).not.toHaveBeenCalled();

    // (a) the mutation committed exactly once (one sale + one payment movement)
    expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createSale', result: 'success' }),
    ).toBe(1);
    // (d) the claim was NOT released — the key stays consumed
    expect(await IdempotencyModel.countDocuments({ userId: USER_ID, action: 'createSale' })).toBe(1);

    // (c) retry with the SAME key → deterministic duplicate, commits NOTHING
    const retry = await createSaleAction(null, fd);
    expect(retry).toEqual({ error: 'error.duplicateRequest' });
    expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    expect(
      await OperationLogModel.countDocuments({ userId: USER_ID, action: 'createSale', result: 'duplicate' }),
    ).toBe(1);
  });
});