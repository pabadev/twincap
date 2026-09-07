import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MongoMonitorGuard,
  MAX_FINGERPRINTS_PER_IP,
  FINGERPRINT_WINDOW_MS,
  GLOBAL_COOLDOWN_THRESHOLD,
  GLOBAL_WINDOW_MS,
  GLOBAL_COOLDOWN_MS,
} from './monitor-guard';
import { MonitorFingerprintModel } from '../models/monitor-fingerprint';
import { MonitorCooldownModel } from '../models/monitor-cooldown';

/**
 * R14-G §6: real Mongo tests of the monitor guard (per-IP fingerprint budget +
 * global anti-spike cooldown) against an in-memory STANDALONE MongoDB.
 *
 * Both protections only rely on atomic single-document writes ($addToSet,
 * $inc, $max) — document-level write serialization works on a standalone
 * node, so MongoMemoryServer (not a replica set) is the right, faster shape,
 * mirroring the §25-C rate-limiter concurrency suite.
 *
 * The unique index on `key` (built via Model.init()) guarantees one document
 * per (ip, fixed window) and one singleton for the global cooldown, so
 * concurrent callers serialize on the same document with no find-then-save
 * race: a flood of 40 distinct fingerprints ends with EXACTLY 30 admitted.
 *
 * The clock is injectable: tests advance a mutable `now` to prove window
 * expiry and cooldown lapse without waiting for real time.
 */
describe(
  'MongoMonitorGuard (R14-G §6)',
  () => {
    let mongod: MongoMemoryServer;
    let now: Date;

    const clock = (): Date => new Date(now.getTime());
    const advance = (ms: number): void => {
      now = new Date(now.getTime() + ms);
    };

    function makeGuard(
      overrides: Partial<{
        now: () => Date;
        fingerprintModel: typeof MonitorFingerprintModel;
        cooldownModel: typeof MonitorCooldownModel;
        globalCooldownThreshold: number;
      }> = {},
    ): MongoMonitorGuard {
      return new MongoMonitorGuard({ now: clock, ...overrides });
    }

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('twincap_monitor_guard'));
      // Build the unique key indexes BEFORE firing concurrent writes
      // (autoIndex would also create them, but explicit init() is
      // deterministic — same pattern as the §25-C suite).
      await Promise.all([
        MonitorFingerprintModel.init(),
        MonitorCooldownModel.init(),
      ]);
    }, 60_000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    }, 60_000);

    beforeEach(async () => {
      now = new Date('2026-09-07T12:00:00.000Z');
      await Promise.all([
        MonitorFingerprintModel.deleteMany({}),
        MonitorCooldownModel.deleteMany({}),
      ]);
    });

    describe('limitFingerprints (per-IP budget)', () => {
      it('admits up to MAX_FINGERPRINTS_PER_IP distinct fingerprints per IP/window', async () => {
        const guard = makeGuard();

        for (let i = 0; i < MAX_FINGERPRINTS_PER_IP; i += 1) {
          const r = await guard.limitFingerprints(
            '203.0.113.10',
            `err_distinct_${i}`,
          );
          expect(r).toEqual({ allowed: true, isNew: true });
        }

        // The 31st DISTINCT fingerprint is rejected without touching the doc.
        const blocked = await guard.limitFingerprints(
          '203.0.113.10',
          'err_distinct_overflow',
        );
        expect(blocked).toEqual({ allowed: false, isNew: true });

        const doc = await MonitorFingerprintModel.findOne({ ip: '203.0.113.10' });
        expect(doc).not.toBeNull();
        expect(doc?.fingerprints).toHaveLength(MAX_FINGERPRINTS_PER_IP);
      });

      it('treats a repeated fingerprint as allowed and never consumes quota', async () => {
        const guard = makeGuard();

        for (let i = 0; i < MAX_FINGERPRINTS_PER_IP; i += 1) {
          await guard.limitFingerprints('203.0.113.11', `err_repeat_${i}`);
        }

        // Repeat of a KNOWN fingerprint even at full quota → allowed, not new.
        const repeat = await guard.limitFingerprints(
          '203.0.113.11',
          'err_repeat_0',
        );
        expect(repeat).toEqual({ allowed: true, isNew: false });

        // A fresh fingerprint at full quota → rejected.
        const fresh = await guard.limitFingerprints(
          '203.0.113.11',
          'err_fresh_after_fill',
        );
        expect(fresh).toEqual({ allowed: false, isNew: true });

        // Neither call mutated the document.
        const doc = await MonitorFingerprintModel.findOne({ ip: '203.0.113.11' });
        expect(doc?.fingerprints).toHaveLength(MAX_FINGERPRINTS_PER_IP);
      });

      it('keeps per-IP quotas independent', async () => {
        const guard = makeGuard();
        for (let i = 0; i < MAX_FINGERPRINTS_PER_IP; i += 1) {
          await guard.limitFingerprints('203.0.113.1', `err_a_${i}`);
        }
        // A second IP is on a FRESH budget.
        const other = await guard.limitFingerprints('203.0.113.2', 'err_b_0');
        expect(other).toEqual({ allowed: true, isNew: true });
      });

      it('resets the per-IP quota when the 15-min fixed window lapses', async () => {
        const guard = makeGuard();
        for (let i = 0; i < MAX_FINGERPRINTS_PER_IP; i += 1) {
          await guard.limitFingerprints('203.0.113.12', `err_w1_${i}`);
        }
        expect(
          (await guard.limitFingerprints('203.0.113.12', 'err_w1_overflow'))
            .allowed,
        ).toBe(false);

        // Advance past the 15-min fixed window → a NEW bucket key.
        advance(FINGERPRINT_WINDOW_MS + 1);
        const afterWindow = await guard.limitFingerprints(
          '203.0.113.12',
          'err_w2_0',
        );
        expect(afterWindow).toEqual({ allowed: true, isNew: true });

        // The old bucket doc is retained (TTL sweeps it later); the new bucket
        // owns its own doc — never less than 1 doc per active bucket.
        const docs = await MonitorFingerprintModel.find({ ip: '203.0.113.12' });
        expect(docs).toHaveLength(2);
      });
    });

    describe('global cooldown', () => {
      it('arms when new-fingerprint count exceeds the threshold and lapses after GLOBAL_COOLDOWN_MS', async () => {
        const guard = makeGuard({ globalCooldownThreshold: 5 });

        for (let i = 0; i < 5; i += 1) {
          const r = await guard.registerGlobalFingerprint();
          expect(r.cooldownEntered).toBe(false);
        }
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: false });

        // Count 6 > threshold 5 → cooldown armed.
        const crossing = await guard.registerGlobalFingerprint();
        expect(crossing.cooldownEntered).toBe(true);
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: true });

        // After GLOBAL_COOLDOWN_MS, `cooldownUntil` is in the past.
        advance(GLOBAL_COOLDOWN_MS + 1000);
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: false });
      });

      it('uses the default threshold 30: 30 new fingerprints do NOT arm it, the 31st does', async () => {
        expect(GLOBAL_COOLDOWN_THRESHOLD).toBe(30);

        const guard = makeGuard();
        for (let i = 0; i < GLOBAL_COOLDOWN_THRESHOLD; i += 1) {
          expect((await guard.registerGlobalFingerprint()).cooldownEntered).toBe(
            false,
          );
        }
        expect((await guard.registerGlobalFingerprint()).cooldownEntered).toBe(
          true,
        );
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: true });
      });

      it('counts reset when the 5-min global window lapses (fresh window, no cooldown)', async () => {
        const guard = makeGuard({ globalCooldownThreshold: 5 });
        for (let i = 0; i < 6; i += 1) {
          await guard.registerGlobalFingerprint();
        }
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: true });

        // Past the count window: the next registration opens a FRESH window
        // with count 1 — way below the threshold.
        advance(GLOBAL_WINDOW_MS + 1000);
        const r = await guard.registerGlobalFingerprint();
        expect(r.cooldownEntered).toBe(false);

        const doc = await MonitorCooldownModel.findOne({
          key: 'monitor:global',
        });
        expect(doc?.newFingerprintCount).toBe(1);
      });

      it('returns inCooldown false when no global document exists yet', async () => {
        const guard = makeGuard();
        expect(await guard.checkGlobalCooldown()).toEqual({ inCooldown: false });
      });
    });

    describe('concurrency (§25-C style)', () => {
      it('40 distinct concurrent fingerprints against one IP → exactly 30 allowed-new, 10 rejected, doc intact', async () => {
        const guard = makeGuard();

        const results = await Promise.all(
          Array.from({ length: 40 }, (_, i) =>
            guard.limitFingerprints('198.51.100.20', `err_conc_${i}`),
          ),
        );

        const allowedNew = results.filter((r) => r.allowed && r.isNew);
        const blocked = results.filter((r) => !r.allowed);
        const allowedRepeat = results.filter((r) => r.allowed && !r.isNew);

        // Exactly the serialized budget is admitted; everything else rejected.
        expect(allowedNew).toHaveLength(MAX_FINGERPRINTS_PER_IP);
        expect(blocked).toHaveLength(10);
        expect(blocked.every((r) => r.isNew)).toBe(true);
        expect(allowedRepeat).toHaveLength(0);

        // No doc loss, no duplicates: ONE document holding EXACTLY the budget
        // of distinct fingerprints.
        const docs = await MonitorFingerprintModel.find({ ip: '198.51.100.20' });
        expect(docs).toHaveLength(1);
        expect(docs[0]?.fingerprints).toHaveLength(MAX_FINGERPRINTS_PER_IP);
        expect(new Set(docs[0]?.fingerprints).size).toBe(
          MAX_FINGERPRINTS_PER_IP,
        );
      });
    });

    describe('fail-open contract (never throws)', () => {
      it('returns permissive results when the persistence layer errors', async () => {
        // Silence the structured stderr JSON logged by the fail-open paths.
        const errorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        const explodingFingerprintModel = {
          findOne: vi.fn().mockRejectedValue(new Error('db exploded')),
          findOneAndUpdate: vi.fn().mockRejectedValue(new Error('db exploded')),
          deleteOne: vi.fn().mockRejectedValue(new Error('db exploded')),
          create: vi.fn().mockRejectedValue(new Error('db exploded')),
        } as unknown as typeof MonitorFingerprintModel;
        const explodingCooldownModel = {
          findOne: vi.fn().mockRejectedValue(new Error('db exploded')),
          findOneAndUpdate: vi.fn().mockRejectedValue(new Error('db exploded')),
          updateOne: vi.fn().mockRejectedValue(new Error('db exploded')),
          deleteOne: vi.fn().mockRejectedValue(new Error('db exploded')),
          create: vi.fn().mockRejectedValue(new Error('db exploded')),
        } as unknown as typeof MonitorCooldownModel;

        const guard = new MongoMonitorGuard({
          now: clock,
          fingerprintModel: explodingFingerprintModel,
          cooldownModel: explodingCooldownModel,
        });

        await expect(
          guard.limitFingerprints('1.2.3.4', 'err_x'),
        ).resolves.toEqual({ allowed: true, isNew: true });
        await expect(guard.checkGlobalCooldown()).resolves.toEqual({
          inCooldown: false,
        });
        await expect(guard.registerGlobalFingerprint()).resolves.toEqual({
          cooldownEntered: false,
        });

        errorSpy.mockRestore();
      });
    });
  },
  60_000,
);