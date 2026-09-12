import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MongoMonitorGuard,
  MONITOR_GLOBAL_KEY,
  type MonitorGuardDeps,
} from './monitor-guard';

/**
 * R15.3.1 P1.1 — retry isolation of the monitor guard's create-race catches.
 *
 * Unit tests with INJECTED model stubs (the guard accepts models as deps, so
 * no MongoMemoryServer is needed here): the two create boundaries
 * (`limitFingerprints` and `registerGlobalFingerprint`) must retry ONLY on a
 * genuine E11000 duplicate-key race (error `code === 11000`), with a BOUNDED
 * number of retries; any other error skips the retry and reaches the
 * documented fail-open boundary with the ORIGINAL error message preserved.
 *
 * The guard's public fail-open contract is unchanged: it NEVER throws.
 */

const FIXED_NOW = new Date('2026-09-07T12:00:00.000Z');

interface FingerprintModelStub {
  findOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

interface CooldownModelStub {
  findOne: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

function makeFingerprintStub(overrides: Partial<FingerprintModelStub> = {}) {
  return {
    findOne: overrides.findOne ?? vi.fn(),
    updateOne: overrides.updateOne ?? vi.fn(),
    deleteOne: overrides.deleteOne ?? vi.fn(),
    create: overrides.create ?? vi.fn(),
  } as unknown as MonitorGuardDeps['fingerprintModel'];
}

function makeCooldownStub(overrides: Partial<CooldownModelStub> = {}) {
  return {
    findOne: overrides.findOne ?? vi.fn(),
    findOneAndUpdate: overrides.findOneAndUpdate ?? vi.fn(),
    updateOne: overrides.updateOne ?? vi.fn(),
    deleteOne: overrides.deleteOne ?? vi.fn(),
    create: overrides.create ?? vi.fn(),
  } as unknown as MonitorGuardDeps['cooldownModel'];
}

/** MongoDB duplicate-key shaped error (numeric code 11000, like MongoServerError). */
function duplicateKeyError(message = 'E11000 duplicate key error') {
  return Object.assign(new Error(message), { code: 11000 });
}

/** Mongo-shaped non-duplicate error (numeric code, e.g. network / server selection). */
function nonDuplicateError(message = 'network partition', code = 8000) {
  return Object.assign(new Error(message), { code });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MongoMonitorGuard retry isolation (R15.3.1 P1.1)', () => {
  describe('limitFingerprints', () => {
    it('resolves an E11000 create race through the bounded retry, preserving duplicate semantics', async () => {
      const winnerBucket = {
        key: 'monitor-fp:203.0.113.1:1',
        fingerprints: ['err_race_1'],
      };
      const fingerprintModel = makeFingerprintStub({
        findOne: vi
          .fn()
          .mockResolvedValueOnce(null) // first pass: no active bucket
          .mockResolvedValueOnce(winnerBucket), // retry: winner bucket exists
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValueOnce(duplicateKeyError()),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        fingerprintModel,
      });

      await expect(
        guard.limitFingerprints('203.0.113.1', 'err_race_1'),
      ).resolves.toEqual({ allowed: true, isNew: false });

      // ONE create attempt, ONE retry through findOne — the fingerprint was
      // already registered by the concurrent winner.
      expect(fingerprintModel.findOne).toHaveBeenCalledTimes(2);
      expect(fingerprintModel.create).toHaveBeenCalledTimes(1);
    });

    it('propagates a non-E11000 create error to the fail-open boundary immediately — no retry (R15.3.1 P1.1)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fingerprintModel = makeFingerprintStub({
        findOne: vi.fn().mockResolvedValue(null),
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValue(nonDuplicateError('db exploded', 8000)),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        fingerprintModel,
      });

      // Fail-open by contract (never throws), but the ORIGINAL error surfaces
      // in the structured log and NO retry happened.
      await expect(
        guard.limitFingerprints('203.0.113.1', 'err_x'),
      ).resolves.toEqual({ allowed: true, isNew: true });

      expect(fingerprintModel.findOne).toHaveBeenCalledTimes(1);
      expect(fingerprintModel.create).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db exploded'));
    });

    it('exhausts the bounded E11000 retries and terminates via fail-open — no infinite recursion (R15.3.1 P1.1)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fingerprintModel = makeFingerprintStub({
        findOne: vi.fn().mockResolvedValue(null), // winner never visible
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValue(duplicateKeyError()),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        fingerprintModel,
      });

      await expect(
        guard.limitFingerprints('203.0.113.1', 'err_loop'),
      ).resolves.toEqual({ allowed: true, isNew: true });

      // 1 first attempt + 3 bounded retries = 4 findOne passes, then it STOPS.
      expect(fingerprintModel.findOne).toHaveBeenCalledTimes(4);
      expect(fingerprintModel.create).toHaveBeenCalledTimes(4);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('E11000 duplicate key error'),
      );
    });
  });

  describe('registerGlobalFingerprint', () => {
    it('resolves an E11000 create race through the bounded retry, hitting the $inc path', async () => {
      const cooldownModel = makeCooldownStub({
        findOneAndUpdate: vi
          .fn()
          .mockResolvedValueOnce(null) // first pass: no active window
          .mockResolvedValueOnce({
            // retry: winner window found → $inc path (count below threshold)
            key: MONITOR_GLOBAL_KEY,
            newFingerprintCount: 1,
            windowStart: FIXED_NOW,
            expiresAt: new Date(FIXED_NOW.getTime() + 300_000),
          }),
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValueOnce(duplicateKeyError()),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        cooldownModel,
      });

      await expect(
        guard.registerGlobalFingerprint(),
      ).resolves.toEqual({ cooldownEntered: false });

      expect(cooldownModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(cooldownModel.create).toHaveBeenCalledTimes(1);
    });

    it('propagates a non-E11000 create error to the fail-open boundary immediately — no retry (R15.3.1 P1.1)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const cooldownModel = makeCooldownStub({
        findOneAndUpdate: vi.fn().mockResolvedValue(null),
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValue(nonDuplicateError('db exploded', 8000)),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        cooldownModel,
      });

      await expect(
        guard.registerGlobalFingerprint(),
      ).resolves.toEqual({ cooldownEntered: false });

      expect(cooldownModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(cooldownModel.create).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db exploded'));
    });

    it('exhausts the bounded E11000 retries and terminates via fail-open — no infinite recursion (R15.3.1 P1.1)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const cooldownModel = makeCooldownStub({
        findOneAndUpdate: vi.fn().mockResolvedValue(null), // winner never visible
        deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
        create: vi.fn().mockRejectedValue(duplicateKeyError()),
      });
      const guard = new MongoMonitorGuard({
        now: () => FIXED_NOW,
        cooldownModel,
      });

      await expect(
        guard.registerGlobalFingerprint(),
      ).resolves.toEqual({ cooldownEntered: false });

      // 1 first attempt + 3 bounded retries = 4 findOneAndUpdate passes.
      expect(cooldownModel.findOneAndUpdate).toHaveBeenCalledTimes(4);
      expect(cooldownModel.create).toHaveBeenCalledTimes(4);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('E11000 duplicate key error'),
      );
    });
  });
});